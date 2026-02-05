var lista_hist = document.getElementById('client-history-list');
var form_pedido = document.getElementById('request-form');
var ZAP = '5595991436017';
var usuario_logado = null;
var perfil_do_usuario = null;

function initAuth() {
    supabaseClient.auth.getSession().then(function (dados) {
        checkSession(dados.data.session);
    });

    supabaseClient.auth.onAuthStateChange(function (evt, sessao) {
        if (evt === 'SIGNED_OUT') {
            window.location.href = '../login/index.html';
        } else {
            checkSession(sessao);
        }
    });
}

function checkSession(sessao) {
    if (sessao && sessao.user) {
        usuario_logado = sessao.user;
        getCurrentProfile().then(function (p) {
            perfil_do_usuario = p;
            if (document.getElementById('user-email')) {
                document.getElementById('user-email').textContent = (p && p.nome) ? p.nome : usuario_logado.email;
            }
            if (p && p.role === 'admin') {
                window.location.href = '../admin/index.html';
            }
            loadClientDashboard();
        });
    } else {
        window.location.href = '../login/index.html';
    }
}

function logout() {
    supabaseClient.auth.signOut();
}


function loadClientDashboard() {
    if (!lista_hist) return;

    lista_hist.innerHTML = '<p>Carregando...</p>';

    supabaseClient
        .from('servicos')
        .select('*, aparelhos (marca, modelo)')
        .eq('cliente_profile_id', usuario_logado.id)
        .order('created_at', { ascending: false })
        .then(function (res) {
            if (res.error) {
                console.log("Erro hist: " + res.error);
                lista_hist.innerHTML = '<p>Erro.</p>';
            } else {
                var servicos = res.data;
                if (servicos.length == 0) {
                    lista_hist.innerHTML = '<p>Nada aqui.</p>';
                } else {
                    lista_hist.innerHTML = '';
                    servicos.forEach(function (s) {
                        var div = document.createElement('div');
                        div.className = 'history-item';

                        var cor = 'st-pendente';
                        if (s.status == 'concluido') cor = 'st-concluido';
                        if (s.status == 'cancelado') cor = 'st-cancelado';

                        div.innerHTML = '<div class="history-info"><p class="s-type">' + s.tipo + '</p>' +
                            '<p class="date">' + new Date(s.created_at).toLocaleDateString() + '</p>' +
                            (s.aparelhos ? '<p class="dev">' + s.aparelhos.marca + ' - ' + s.aparelhos.modelo + '</p>' : '') +
                            '</div>' +
                            '<span class="status-badge ' + cor + '">' + (s.status ? s.status.toUpperCase() : 'PENDENTE') + '</span>';
                        lista_hist.appendChild(div);
                    });
                }
            }
            carregarOpcoes();
        });
};

function carregarOpcoes() {
    var sel = document.getElementById('req-service-id');
    var display = document.getElementById('estimated-price');
    var val_display = document.getElementById('price-value');
    var lista_precos = document.getElementById('client-price-list');

    if (!sel) return;

    supabaseClient.from('service_catalog').select('*').eq('active', true).order('name').then(function (res) {
        if (!res.error) {
            var servicos = res.data;
            sel.innerHTML = '<option value="">O que você precisa?</option>';

            servicos.forEach(function (x) {
                var o = document.createElement('option');
                o.value = x.id;
                o.textContent = x.name;
                o.dataset.price = x.price;
                sel.appendChild(o);
            });

            if (lista_precos) {
                lista_precos.innerHTML = '';
                servicos.forEach(function (x) {
                    var d = document.createElement('div');
                    d.className = 'price-row';
                    d.innerHTML = '<div><div class="font-medium">' + x.name + '</div></div>' +
                        '<span class="price-val">R$ ' + x.price + '</span>';
                    lista_precos.appendChild(d);
                });
            }

            sel.onchange = function () {
                var opt = sel.options[sel.selectedIndex];
                if (opt.value) {
                    display.classList.remove('hidden');
                    val_display.textContent = opt.dataset.price;
                } else {
                    display.classList.add('hidden');
                }
            };
        }
    });
}


if (form_pedido) {
    form_pedido.onsubmit = function (e) {
        e.preventDefault();

        var sel = document.getElementById('req-service-id');
        if (!sel.value) { alert('Escolhe o serviço ai'); return; }

        var opt = sel.options[sel.selectedIndex];
        var nome_servico = opt.text;
        var preco = opt.dataset.price;

        var marca = document.getElementById('req-brand').value;
        var modelo = document.getElementById('req-model').value;
        var obs = document.getElementById('req-notes').value;

        supabaseClient.from('clientes').select('id').eq('user_id', usuario_logado.id).single().then(function (resCli) {
            var client_id = resCli.data ? resCli.data.id : null;

            function doRequest(id_final_cliente) {
                supabaseClient.from('aparelhos').insert([{
                    cliente_id: id_final_cliente,
                    marca: marca,
                    modelo: modelo,
                    tipo: 'split'
                }]).select().single().then(function (resAp) {
                    if (resAp.error) {
                        alert('Erro ap: ' + resAp.error.message);
                        return;
                    }
                    var id_ap = resAp.data.id;

                    supabaseClient.from('servicos').insert([{
                        aparelho_id: id_ap,
                        tipo: nome_servico,
                        cliente_profile_id: usuario_logado.id,
                        observacoes: obs + ' (R$ ' + preco + ')',
                        status: 'pendente'
                    }]).then(function (resServ) {
                        if (resServ.error) {
                            alert('Erro serviço: ' + resServ.error.message);
                        } else {
                            // zap
                            var zap_msg = 'Oi, sou ' + perfil_do_usuario.nome + '. Quero ' + nome_servico + ' (R$ ' + preco + '). Aparelho: ' + marca + ' ' + modelo;
                            var url = 'https://wa.me/' + ZAP + '?text=' + encodeURIComponent(zap_msg);
                            window.open(url, '_blank');

                            alert('Pedido feito!');
                            form_pedido.reset();
                            loadClientDashboard();
                        }
                    });
                });
            }

            if (!client_id) {
                // cria cliente
                supabaseClient.from('clientes').insert([{
                    nome: perfil_do_usuario.nome || 'Cliente',
                    whatsapp: perfil_do_usuario.telefone || '',
                    endereco: perfil_do_usuario.endereco || '',
                    user_id: usuario_logado.id
                }]).select().single().then(function (newC) {
                    doRequest(newC.data.id);
                });
            } else {
                doRequest(client_id);
            }
        });
    };
}

document.addEventListener('DOMContentLoaded', initAuth);

const profileModal = document.getElementById('profile-modal');
const btnCloseProfile = document.getElementById('close-profile-modal');
const profileForm = document.getElementById('profile-form');

window.openProfileModal = () => {
    if (!profileModal) return;
    const nameInput = document.getElementById('edit-name');
    const phoneInput = document.getElementById('edit-phone');
    if (nameInput) nameInput.value = perfil_do_usuario.nome || '';
    if (phoneInput) phoneInput.value = perfil_do_usuario.telefone || '';
    document.getElementById('edit-password').value = '';
    profileModal.classList.remove('hidden');
};

if (btnCloseProfile) btnCloseProfile.addEventListener('click', () => profileModal.classList.add('hidden'));

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('edit-name').value;
        const newPhone = document.getElementById('edit-phone').value;
        const newPassword = document.getElementById('edit-password').value;

        await supabaseClient.from('profiles').update({ nome: newName, telefone: newPhone }).eq('id', usuario_logado.id);

        if (newPassword) {
            await supabaseClient.auth.updateUser({ password: newPassword });
        }
        alert('Perfil atualizado');
        profileModal.classList.add('hidden');
        perfil_do_usuario.nome = newName;
        perfil_do_usuario.telefone = newPhone;
        if (document.getElementById('user-email')) {
            document.getElementById('user-email').textContent = newName;
        }
    });
}
