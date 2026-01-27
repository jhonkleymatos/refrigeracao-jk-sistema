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

        // 1. Garantir que exite um Cliente para vincular o "Aparelho Portfólio"
        // (Já que a tabela aparelhos exige cliente_id NOT NULL)

        let portfolioClientId = null;

        // Tenta achar o cliente "Portfólio Geral"
        const { data: existingClient } = await window.supabaseClient
            .from('clientes')
            .select('id')
            .eq('nome', 'Portfólio Geral')
            .single();

        if (existingClient) {
            portfolioClientId = existingClient.id;
        } else {
            // Cria o cliente se não existir
            const { data: newClient, error: clientError } = await window.supabaseClient
                .from('clientes')
                .insert([{
                    nome: 'Portfólio Geral',
                    whatsapp: '00000000000',
                    endereco: 'Sistema'
                }])
                .select()
                .single();

            if (clientError) {
                console.error("Erro ao criar cliente portfólio:", clientError);
                alert("Erro interno: Não foi possível preparar o sistema para upload (Erro Cliente).");
                return;
            }
            portfolioClientId = newClient.id;
        }

        // 2. Criar ou Buscar Aparelho "Portfólio" vinculado a esse cliente
        let apId = null;

        const { data: aparelho, error: apError } = await window.supabaseClient
            .from('aparelhos')
            .insert([{
                marca: 'Portfólio',
                modelo: 'Fotos Avulsas',
                tipo: 'outro',
                cliente_id: portfolioClientId
            }])
            .select()
            .single();

        if (apError) {
            console.warn("Aparelho portfólio talvez já exista ou erro:", apError);
            // Se falhar, tenta pegar o ultimo desse cliente
            const { data: existingApp } = await window.supabaseClient
                .from('aparelhos')
                .select('id')
                .eq('cliente_id', portfolioClientId)
                .limit(1)
                .single();

            if (!existingApp) {
                alert("Erro CRÍTICO: Não foi possível encontrar um aparelho de Portfólio.");
                return;
            }
            apId = existingApp.id;
        } else {
            apId = aparelho.id;
        }

        if (!apId) {
            alert("Erro Desconhecido: ID do aparelho é nulo.");
            return;
        }

        // 3. Criar o Serviço
        const user = await window.supabaseClient.auth.getUser();
        const userId = user.data.user?.id;

        const { data: service, error: servError } = await window.supabaseClient
            .from('servicos')
            .insert([{
                aparelho_id: apId,
                tipo: 'Portfólio',
                cliente_profile_id: userId, // O admin criando
                status: 'concluido',
                observacoes: 'Foto adicionada via Upload Rápido'
            }])
            .select()
            .single();

        if (servError) {
            alert("Erro ao criar registro de serviço: " + servError.message);
            return;
        }

        await uploadPhotos(files, service.id);

        quickUploadModal.classList.add('hidden');
        quickUploadForm.reset();
        alert("Fotos adicionadas ao Portfólio com sucesso!");
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

// --- CATALOG MANAGEMENT ---

const catalogModal = document.getElementById('catalog-modal');
const catalogListBody = document.getElementById('catalog-list-body');
const catalogForm = document.getElementById('catalog-form');
const btnManageCatalog = document.getElementById('btn-manage-catalog');
const btnCloseCatalog = document.getElementById('close-catalog-modal');
const btnClearCatalog = document.getElementById('btn-clear-catalog');

// Elementos do form
const catIdInput = document.getElementById('cat-id');
const catNameInput = document.getElementById('cat-name');
const catPriceInput = document.getElementById('cat-price');
const catDescInput = document.getElementById('cat-desc');

// Open Modal
if (btnManageCatalog) {
    btnManageCatalog.addEventListener('click', () => {
        catalogModal.classList.remove('hidden');
        loadCatalogManagement();
    });
}

if (btnCloseCatalog) {
    btnCloseCatalog.addEventListener('click', () => {
        catalogModal.classList.add('hidden');
    });
}

if (btnClearCatalog) {
    btnClearCatalog.addEventListener('click', () => {
        catalogForm.reset();
        catIdInput.value = '';
    });
}

// Load List
async function loadCatalogManagement() {
    if (!catalogListBody) return;

    catalogListBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">Carregando...</td></tr>';

    const { data: items, error } = await window.supabaseClient
        .from('service_catalog')
        .select('*')
        .order('name');

    if (error) {
        console.error("Erro catalogo:", error);
        catalogListBody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Erro ao carregar (Verifique o script SQL).</td></tr>';
        return;
    }

    catalogListBody.innerHTML = '';
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'border-b hover:bg-gray-50';
        tr.innerHTML = `
            <td class="p-2">
                <div class="font-bold text-gray-800">${item.name}</div>
                <div class="text-xs text-gray-500">${item.description || ''}</div>
            </td>
            <td class="p-2 text-green-700 font-bold">R$ ${item.price}</td>
            <td class="p-2 text-right space-x-2">
                <button onclick="editCatalogItem('${item.id}', '${item.name}', '${item.price}', '${item.description || ''}')" class="text-blue-600 hover:text-blue-800"><i class="fas fa-edit"></i></button>
                <button onclick="deleteCatalogItem('${item.id}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
            </td>
        `;
        catalogListBody.appendChild(tr);
    });
}

// Global functions for inline onclick
window.editCatalogItem = (id, name, price, desc) => {
    catIdInput.value = id;
    catNameInput.value = name;
    catPriceInput.value = price;
    catDescInput.value = desc;
};

window.deleteCatalogItem = async (id) => {
    if (!confirm("Excluir este serviço do catálogo?")) return;

    const { error } = await window.supabaseClient
        .from('service_catalog')
        .delete()
        .eq('id', id);

    if (error) alert("Erro ao excluir: " + error.message);
    else loadCatalogManagement();
};

// Save (Add/Edit)
if (catalogForm) {
    catalogForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = catIdInput.value;
        const name = catNameInput.value;
        const price = catPriceInput.value;
        const desc = catDescInput.value;

        let error = null;

        if (id) {
            // Update
            const { error: err } = await window.supabaseClient
                .from('service_catalog')
                .update({ name, price, description: desc })
                .eq('id', id);
            error = err;
        } else {
            // Insert
            const { error: err } = await window.supabaseClient
                .from('service_catalog')
                .insert([{ name, price, description: desc }]);
            error = err;
        }

        if (error) {
            alert("Erro ao salvar: " + error.message);
        } else {
            catalogForm.reset();
            catIdInput.value = '';
            loadCatalogManagement();
        }
    });
}
