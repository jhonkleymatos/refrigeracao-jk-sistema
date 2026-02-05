var div_admin_lista = document.getElementById('admin-services-list');
var form_concluir = document.getElementById('complete-service-form');
var modal_admin = document.getElementById('admin-modal');
var modal_rapido = document.getElementById('quick-upload-modal');
var form_rapido = document.getElementById('quick-upload-form');
var id_servico_atual = null;
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
            if (!p || p.role !== 'admin') {
                window.location.href = '../cliente/index.html';
            }
            loadAdminDashboard();
        });
    } else {
        window.location.href = '../login/index.html';
    }
}
function logout() {
    supabaseClient.auth.signOut();
}

// Carregar Dashboard (Serviços Pendentes/Em andamento)
function loadAdminDashboard() {
    if (!div_admin_lista) return;

    div_admin_lista.innerHTML = '<p>Carregando coisas...</p>';

    supabaseClient.from('servicos').select('*, profiles(nome,telefone), aparelhos(marca,modelo)').order('created_at', { ascending: false }).then(function (res) {
        if (res.error) {
            console.log('Erro admin: ' + res.error.message);
            div_admin_lista.innerHTML = '<p>Erro.</p>';
            return;
        }

        var lista = res.data;
        if (!lista || lista.length == 0) {
            div_admin_lista.innerHTML = '<p>Sem nada.</p>';
            return;
        }

        div_admin_lista.innerHTML = '';
        lista.forEach(function (item) {
            if (item.tipo == 'Portfólio') return;

            var div = document.createElement('div');
            var classe = (item.status == 'pendente') ? 'service-card card-pending' : 'service-card card-done';

            div.className = classe;
            div.innerHTML = '<h3>' + item.tipo + ' (' + item.status + ')</h3>' +
                '<p>Cli: ' + (item.profiles ? item.profiles.nome : '?') + '</p>' +
                '<p>Ap: ' + (item.aparelhos ? item.aparelhos.marca : '?') + '</p>' +
                '<p>"' + (item.observacoes || '') + '"</p>';

            if (item.status != 'concluido') {
                div.innerHTML += '<button onclick="abrirModal(\'' + item.id + '\')" class="btn-complete">Concluir</button>';
            }

            div_admin_lista.appendChild(div);
        });
    });
};

window.abrirModal = function (id) {
    id_servico_atual = id;
    modal_admin.classList.remove('hidden');
};

if (document.getElementById('close-modal')) {
    document.getElementById('close-modal').onclick = function () {
        modal_admin.classList.add('hidden');
    };
}

if (document.getElementById('btn-quick-upload')) {
    document.getElementById('btn-quick-upload').onclick = function () {
        modal_rapido.classList.remove('hidden');
    };
}
if (document.getElementById('close-quick-modal')) {
    document.getElementById('close-quick-modal').onclick = function () {
        modal_rapido.classList.add('hidden');
    };
}

if (form_concluir) {
    form_concluir.onsubmit = function (e) {
        e.preventDefault();

        var val = document.getElementById('final-price').value;
        var inputs = document.getElementById('final-photos');
        var arqs = inputs.files;

        supabaseClient.from('servicos').update({ status: 'concluido', valor: val }).eq('id', id_servico_atual).then(function (res) {
            if (res.error) {
                alert('Erro: ' + res.error.message);
            } else {
                uploadFotosAdmin(arqs, id_servico_atual, function () {
                    alert('Concluido!');
                    modal_admin.classList.add('hidden');
                    form_concluir.reset();
                    loadAdminDashboard();
                });
            }
        });
    };
}

function uploadFotosAdmin(files, sId, callback) {
    if (!files || files.length == 0) {
        if (callback) callback();
        return;
    }

    var total = files.length;
    var atual = 0;

    function up() {
        if (atual >= total) {
            if (callback) callback();
            return;
        }

        var f = files[atual];
        var n = sId + '/' + Math.random();

        supabaseClient.storage.from('servicos-fotos').upload(n, f).then(function (res) {
            if (!res.error) {
                var url = supabaseClient.storage.from('servicos-fotos').getPublicUrl(n).data.publicUrl;
                supabaseClient.from('fotos_servico').insert([{
                    servico_id: sId,
                    url_foto: url,
                    nome_arquivo: n
                }]).then(function () {
                    atual++;
                    up();
                });
            } else {
                console.log("Erro up " + res.error.message);
                atual++;
                up();
            }
        });
    }

    up();
}

if (form_rapido) {
    form_rapido.addEventListener('submit', function (e) {
        e.preventDefault();
        var files = document.getElementById('quick-photos').files;
        supabaseClient.from('clientes').select('id').eq('nome', 'Portfólio Geral').single().then(function (resC) {
            var cliId = null;

            function step2(cId) {
                supabaseClient.from('aparelhos').insert([{
                    marca: 'Portfólio',
                    modelo: 'Avulso',
                    tipo: 'outro',
                    cliente_id: cId
                }]).select().single().then(function (resA) {
                    var apId = resA.data.id;

                    supabaseClient.auth.getUser().then(function (u) {
                        supabaseClient.from('servicos').insert([{
                            aparelho_id: apId,
                            tipo: 'Portfólio',
                            cliente_profile_id: u.data.user.id,
                            status: 'concluido',
                            observacoes: 'Upload rapido'
                        }]).select().single().then(function (resS) {
                            var sId = resS.data.id;
                            uploadFotosAdmin(files, sId, function () {
                                alert('Enviado pro portfolio!');
                                modal_rapido.classList.add('hidden');
                                form_rapido.reset();
                                if (window.loadGallery) window.loadGallery();
                            });
                        });
                    });
                });
            }

            if (resC.data) {
                step2(resC.data.id);
            } else {
                supabaseClient.from('clientes').insert([{
                    nome: 'Portfólio Geral',
                    whatsapp: '00',
                    endereco: 'Sys'
                }]).select().single().then(function (newC) {
                    step2(newC.data.id);
                });
            }
        });
    });
}

var modal_cat = document.getElementById('catalog-modal');
var corpo_tab = document.getElementById('catalog-list-body');
var form_cat = document.getElementById('catalog-form');
var inp_id = document.getElementById('cat-id');
var inp_nome = document.getElementById('cat-name');
var inp_preco = document.getElementById('cat-price');
var inp_desc = document.getElementById('cat-desc');

if (document.getElementById('btn-manage-catalog')) {
    document.getElementById('btn-manage-catalog').onclick = function () {
        modal_cat.classList.remove('hidden');
        carregarCatalogo();
    };
}

if (document.getElementById('close-catalog-modal')) {
    document.getElementById('close-catalog-modal').onclick = function () {
        modal_cat.classList.add('hidden');
    };
}

function carregarCatalogo() {
    supabaseClient.from('service_catalog').select('*').order('name').then(function (res) {
        corpo_tab.innerHTML = '';
        if (res.data) {
            res.data.forEach(function (i) {
                var tr = document.createElement('tr');
                tr.innerHTML = '<td>' + i.name + '</td><td>' + i.price + '</td>' +
                    '<td><button onclick="editar(\'' + i.id + '\', \'' + i.name + '\', \'' + i.price + '\')">Edit</button></td>';
                corpo_tab.appendChild(tr);
            });
        }
    });
}

window.editar = function (id, n, p) {
    inp_id.value = id;
    inp_nome.value = n;
    inp_preco.value = p;
};

if (form_cat) {
    form_cat.onsubmit = function (e) {
        e.preventDefault();
        var id = inp_id.value;
        var obj = { name: inp_nome.value, price: inp_preco.value, description: inp_desc.value };

        var promessa;
        if (id) {
            promessa = supabaseClient.from('service_catalog').update(obj).eq('id', id);
        } else {
            promessa = supabaseClient.from('service_catalog').insert([obj]);
        }

        promessa.then(function (res) {
            if (res.error) alert('Erro: ' + res.error.message);
            else {
                alert('Salvo.');
                form_cat.reset();
                inp_id.value = '';
                carregarCatalogo();
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
