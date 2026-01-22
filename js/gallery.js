// Galeria de Fotos

const galleryGrid = document.getElementById('gallery-grid');

async function loadGallery() {
    if (!galleryGrid) return;

    galleryGrid.innerHTML = '<p class="text-gray-500 text-center col-span-full">Carregando fotos...</p>';

    // Busca fotos com dados do serviço associado
    const { data: photos, error } = await window.supabaseClient
        .from('fotos_servico')
        .select(`
            id,
            url_foto,
            servicos (
                tipo,
                data_execucao,
                aparelhos (
                    marca,
                    modelo
                )
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        galleryGrid.innerHTML = `<p class="text-red-500 text-center col-span-full">Erro ao carregar galeria: ${error.message}</p>`;
        return;
    }

    if (!photos || photos.length === 0) {
        galleryGrid.innerHTML = '<p class="text-gray-500 text-center col-span-full">Nenhuma foto encontrada.</p>';
        return;
    }

    galleryGrid.innerHTML = ''; // Limpa loading

    photos.forEach(photo => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300';

        const serviceType = photo.servicos?.tipo || 'Serviço';
        const date = photo.servicos?.data_execucao || '';
        const model = photo.servicos?.aparelhos?.modelo || '';
        const brand = photo.servicos?.aparelhos?.marca || '';

        card.innerHTML = `
            <div class="aspect-w-16 aspect-h-9 w-full h-48 bg-gray-200">
                <img src="${photo.url_foto}" alt="Foto do serviço" class="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300">
            </div>
            <div class="p-4">
                <h3 class="font-bold text-gray-800 text-sm">${serviceType}</h3>
                <p class="text-xs text-gray-500">${brand} ${model}</p>
                <p class="text-xs text-gray-400 mt-1">${date}</p>
            </div>
        `;
        galleryGrid.appendChild(card);
    });
}

// Inicializar Galeria (pode ser chamada publicamente)
document.addEventListener('DOMContentLoaded', loadGallery);
