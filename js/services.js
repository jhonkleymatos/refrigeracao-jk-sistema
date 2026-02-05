// Gerenciamento de Serviços e Upload

var form_servico = document.getElementById('service-form');
var select_cliente = document.getElementById('client-select');
var select_aparelho = document.getElementById('appliance-select');

// Carregar Clientes para o Select
// carrega clientes
function carregarClientes() {
    supabaseClient.from('clientes').select('id, nome').then(function (res) {
        if (res.error) {
            console.log('Erro clientes: ' + res.error.message);
            return;
        }
        var lista = res.data;
        select_cliente.innerHTML = '<option value="">Escolha...</option>';
        for (var i = 0; i < lista.length; i++) {
            var opt = document.createElement('option');
            opt.value = lista[i].id;
            opt.textContent = lista[i].nome;
            select_cliente.appendChild(opt);
        }
    });
}

// Carregar Aparelhos quando Cliente é selecionado
function carregarAparelhos(id) {
    supabaseClient.from('aparelhos').select('id, marca, modelo, tipo').eq('cliente_id', id).then(function (res) {
        if (res.error) {
            console.log('Erro aparelhos');
            return;
        }
        var itens = res.data;
        select_aparelho.innerHTML = '<option value="">Escolha...</option>';
        for (var j = 0; j < itens.length; j++) {
            var o = document.createElement('option');
            o.value = itens[j].id;
            o.textContent = itens[j].marca + ' - ' + itens[j].modelo;
            select_aparelho.appendChild(o);
        }
        select_aparelho.disabled = false;
    });
}

if (select_cliente) {
    select_cliente.onchange = function (e) {
        var val = e.target.value;
        if (val) {
            carregarAparelhos(val);
        } else {
            select_aparelho.disabled = true;
        }
    };
}

// Submissão do Formulário de Serviço
if (form_servico) {
    form_servico.onsubmit = function (e) {
        e.preventDefault();

        var ap = select_aparelho.value;
        var tp = document.getElementById('service-type').value;
        var dt = document.getElementById('service-date').value;
        var pr = document.getElementById('service-price').value;
        var obs = document.getElementById('service-notes').value;
        var inputs_fotos = document.getElementById('service-photos');
        var arqs = inputs_fotos.files;

        if (!ap) { alert('Escolha o aparelho'); return; }

        supabaseClient.from('servicos').insert([{
            aparelho_id: ap,
            tipo: tp,
            data_execucao: dt,
            valor: pr,
            observacoes: obs
        }]).select().single().then(function (resServico) {
            if (resServico.error) {
                alert('Erro servico: ' + resServico.error.message);
            } else {
                var id_servico = resServico.data.id;
                console.log('Servico criado ' + id_servico);

                if (arqs.length > 0) {
                    var cont = 0;
                    // Upload recursivo "porco"
                    function uploadFoto(idx) {
                        if (idx >= arqs.length) {
                            alert('Tudo salvo!');
                            form_servico.reset();
                            return;
                        }

                        var f = arqs[idx];
                        var nome_arq = id_servico + '/' + Math.random() + '.jpg'; // forçando extensao jpg preguiçosa

                        supabaseClient.storage.from('servicos-fotos').upload(nome_arq, f).then(function (resUp) {
                            if (resUp.error) {
                                console.log('Erro up: ' + resUp.error.message);
                                uploadFoto(idx + 1); // tenta proximo
                            } else {
                                var url = supabaseClient.storage.from('servicos-fotos').getPublicUrl(nome_arq).data.publicUrl;

                                supabaseClient.from('fotos_servico').insert([{
                                    servico_id: id_servico,
                                    url_foto: url,
                                    nome_arquivo: nome_arq
                                }]).then(function () {
                                    cont++;
                                    uploadFoto(idx + 1);
                                });
                            }
                        });
                    }
                    uploadFoto(0);
                } else {
                    alert('Salvo sem fotos');
                    form_servico.reset();
                }
            }
        });
    };
}


document.addEventListener('DOMContentLoaded', function () {
    if (select_cliente) carregarClientes();
});
