// Galeria de Fotos

// Galeria
var grid = document.getElementById('gallery-grid');

function loadGallery() {
    if (!grid) return;
    grid.innerHTML = '<p>Fotos...</p>';

    supabaseClient.from('fotos_servico').select('id, url_foto, servicos(tipo, data_execucao, aparelhos(marca, modelo))').order('created_at', { ascending: false }).then(function (res) {
        if (res.error) {
            grid.innerHTML = '<p>Erro galeria</p>';
            return;
        }

        var fotos = res.data;
        if (!fotos || fotos.length == 0) {
            grid.innerHTML = '<p>Sem fotos</p>';
            return;
        }

        grid.innerHTML = '';

        for (var i = 0; i < fotos.length; i++) {
            var f = fotos[i];
            var tipo = f.servicos ? f.servicos.tipo : 'Serviço';
            var data = f.servicos ? f.servicos.data_execucao : '';
            var marca = (f.servicos && f.servicos.aparelhos) ? f.servicos.aparelhos.marca : '';
            var modelo = (f.servicos && f.servicos.aparelhos) ? f.servicos.aparelhos.modelo : '';

            var card = document.createElement('div');
            card.className = 'gallery-card';

            card.innerHTML = '<img src="' + f.url_foto + '">' +
                '<h4>' + tipo + '</h4>' +
                '<p class="meta">' + marca + ' ' + modelo + '</p>' +
                '<p class="date">' + data + '</p>';

            grid.appendChild(card);
        }
    });
}

document.addEventListener('DOMContentLoaded', loadGallery);
