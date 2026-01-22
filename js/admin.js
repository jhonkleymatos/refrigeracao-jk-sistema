// Lógica da Área do Técnico (Admin)

const adminServicesList = document.getElementById('admin-services-list');
const completeServiceForm = document.getElementById('complete-service-form');
const adminModal = document.getElementById('admin-modal');
const quickUploadModal = document.getElementById('quick-upload-modal');
const quickUploadForm = document.getElementById('quick-upload-form');

let currentServiceId = null;

// Carregar Dashboard (Serviços Pendentes/Em andamento)
window.loadAdminDashboard = async () => {
    if (!adminServicesList) return;

    adminServicesList.innerHTML = '<p class="text-gray-500 col-span-full">Carregando solicitações...</p>';

    const { data: services, error } = await window.supabaseClient
        .from('servicos')
        .select(`
            id, tipo, status, observacoes, created_at,
            profiles (nome, endereco, telefone),
            aparelhos (marca, modelo)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro admin:", error);
        adminServicesList.innerHTML = '<p class="text-red-500 col-span-full">Erro ao carregar solicitações. Verifique o console.</p>';
        return;
    }

    if (!services || services.length === 0) {
        adminServicesList.innerHTML = `
            <div class="col-span-full text-center py-10 bg-white rounded-lg shadow">
                <i class="fas fa-clipboard-check text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">Nenhuma solicitação de serviço encontrada.</p>
                <p class="text-sm text-gray-400">As solicitações dos clientes aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    adminServicesList.innerHTML = '';
    services.forEach(service => {
        // Ocultar serviços de "Portfólio" da lista de pendências
        if (service.tipo === 'Portfólio') return;

        const card = document.createElement('div');
        card.className = service.status === 'pendente'
            ? 'bg-white border-l-4 border-yellow-400 p-4 rounded shadow'
            : 'bg-gray-50 border-l-4 border-green-500 p-4 rounded shadow opacity-75';

        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-lg text-blue-900">${service.tipo}</h3>
                <span class="text-xs font-semibold px-2 py-1 rounded ${service.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">${service.status}</span>
            </div>
            <p class="text-sm text-gray-600 mb-1"><strong>Cliente:</strong> ${service.profiles?.nome || 'Desconhecido'}</p>
            <p class="text-sm text-gray-600 mb-1"><strong>Aparelho:</strong> ${service.aparelhos?.marca} ${service.aparelhos?.modelo}</p>
            <p class="text-sm text-gray-500 mb-2 italic">"${service.observacoes || 'Sem obs'}"</p>
            
            <div class="mt-4 flex space-x-2">
                ${service.status !== 'concluido' ? `
                    <button onclick="openCompleteModal('${service.id}')" class="flex-1 bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-check mr-1"></i> Concluir / Fotos
                    </button>
                    <a href="https://wa.me/${service.profiles?.telefone?.replace(/\D/g, '')}" target="_blank" class="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                ` : '<button class="text-gray-400 text-sm cursor-default" disabled>Concluído</button>'}
            </div>
        `;
        adminServicesList.appendChild(card);
    });
};

// Modal Logic
window.openCompleteModal = (serviceId) => {
    currentServiceId = serviceId;
    adminModal.classList.remove('hidden');
};

if (document.getElementById('close-modal')) {
    document.getElementById('close-modal').addEventListener('click', () => {
        adminModal.classList.add('hidden');
        currentServiceId = null;
    });
}

// Quick Upload Modal Logic
if (document.getElementById('btn-quick-upload')) {
    document.getElementById('btn-quick-upload').addEventListener('click', () => {
        quickUploadModal.classList.remove('hidden');
    });
}

if (document.getElementById('close-quick-modal')) {
    document.getElementById('close-quick-modal').addEventListener('click', () => {
        quickUploadModal.classList.add('hidden');
    });
}

// Finalizar Serviço (Upload fotos + Valor)
completeServiceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentServiceId) return;

    const valor = document.getElementById('final-price').value;
    const files = document.getElementById('final-photos').files;

    // 1. Atualizar Serviço (Status e Valor)
    const { error: updateError } = await window.supabaseClient
        .from('servicos')
        .update({ status: 'concluido', valor: valor })
        .eq('id', currentServiceId);

    if (updateError) {
        alert("Erro ao atualizar serviço.");
        return;
    }

    // 2. Upload de Fotos
    await uploadPhotos(files, currentServiceId);

    adminModal.classList.add('hidden');
    completeServiceForm.reset();
    window.loadAdminDashboard();
});

// Upload Avulso (Portfólio)
if (quickUploadForm) {
    quickUploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const files = document.getElementById('quick-photos').files;
        if (files.length === 0) return;

        // 1. Encontrar ou Criar Serviço de "Portfólio"
        // Precisamos do ID do admin para criar
        const user = await window.supabaseClient.auth.getUser();
        const userId = user.data.user.id;

        // Primeiro tenta achar um aparelho genérico "Portfólio"
        let aparelhoId = null;

        // Simplificando: Criamos um serviço "Portfólio" novo toda vez ou buscamos um existente?
        // Vamos criar um serviço novo do tipo "Portfólio" marcado como concluído.

        // Criar aparelho dummy se precisar (ou usar null se o banco permitisse, mas não permite)
        const { data: aparelho, error: apError } = await window.supabaseClient
            .from('aparelhos')
            .insert([{ marca: 'Portfólio', modelo: 'Geral', tipo: 'outro', cliente_id: null }]) // cliente_id null se permitido, senão teremos erro
            .select()
            .single();

        // Se der erro de cliente_id not null na tabela aparelhos, teríamos que criar um cliente dummy.
        // Assumindo que a tabela aparelhos permite cliente_id nulo ou RLS permite.
        // Se falhar, vamos alertar.

        if (apError) {
            // Fallback: Tenta buscar um aparelho existente qualquer para vincular
            // Ou criar um cliente fake
            console.warn("Criando aparelho portfólio falhou, tentando usar existente ou continuar...", apError);
        }

        const apId = aparelho ? aparelho.id : (await getAnyApplianceId());

        const { data: service, error: servError } = await window.supabaseClient
            .from('servicos')
            .insert([{
                aparelho_id: apId,
                tipo: 'Portfólio',
                cliente_profile_id: userId, // O próprio admin como "dono"
                status: 'concluido',
                observacoes: 'Foto adicionada via Upload Rápido'
            }])
            .select()
            .single();

        if (servError) {
            alert("Erro ao criar registro de portfólio: " + servError.message);
            return;
        }

        await uploadPhotos(files, service.id);

        quickUploadModal.classList.add('hidden');
        quickUploadForm.reset();
        alert("Fotos adicionadas ao Portfólio!");
        // Opcional: Atualizar a galeria se ela estiver visível na página
        if (window.loadGallery) window.loadGallery();
    });
}

// Helper para pegar qualquer aparelho (se falhar criação)
async function getAnyApplianceId() {
    const { data } = await window.supabaseClient.from('aparelhos').select('id').limit(1);
    return data[0]?.id;
}

// Função Helper de Upload
async function uploadPhotos(files, serviceId) {
    if (files.length > 0) {
        let uploadCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileExt = file.name.split('.').pop();
            const fileName = `${serviceId}/${Math.random()}.${fileExt}`;

            const { error: uploadError } = await window.supabaseClient
                .storage
                .from('servicos-fotos')
                .upload(fileName, file);

            if (!uploadError) {
                const { data: { publicUrl } } = window.supabaseClient
                    .storage
                    .from('servicos-fotos')
                    .getPublicUrl(fileName);

                await window.supabaseClient
                    .from('fotos_servico')
                    .insert([{ servico_id: serviceId, url_foto: publicUrl, nome_arquivo: fileName }]);

                uploadCount++;
            } else {
                console.error("Erro upload:", uploadError);
            }
        }
        return uploadCount;
    }
}
