// Lógica da Área do Cliente

const clientHistoryList = document.getElementById('client-history-list');
const requestForm = document.getElementById('request-form');

// CONFIGURAÇÃO WHATSAPP DA EMPRESA
// Coloque o número do Admin aqui (apenas números, com DDD)
const COMPANY_WHATSAPP = '5595991436017'; // <--- EDITE AQUI SEU NÚMERO

// Carregar Histórico de Serviços do Cliente
window.loadClientDashboard = async () => {
    if (!clientHistoryList) return;

    clientHistoryList.innerHTML = '<p class="text-gray-500">Carregando seus serviços...</p>';

    // Pega o ID do user atual
    const { data: { user } } = await window.supabaseClient.auth.getUser();

    const { data: services, error } = await window.supabaseClient
        .from('servicos')
        .select(`
            *,
            aparelhos (marca, modelo)
        `)
        .eq('cliente_profile_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao carregar histórico:", error);
        clientHistoryList.innerHTML = '<p class="text-red-500">Erro ao carregar serviços.</p>';
        return;
    }

    if (services.length === 0) {
        clientHistoryList.innerHTML = '<p class="text-gray-500">Você ainda não solicitou nenhum serviço.</p>';
        return;
    }

    clientHistoryList.innerHTML = '';
    services.forEach(service => {
        const item = document.createElement('div');
        item.className = 'border-bm border-gray-100 py-3 flex justify-between items-center';

        let statusColor = 'text-yellow-600';
        if (service.status === 'concluido') statusColor = 'text-green-600';
        if (service.status === 'cancelado') statusColor = 'text-red-600';

        item.innerHTML = `
            <div>
                <p class="font-bold text-gray-800">${service.tipo}</p>
                <p class="text-sm text-gray-500">${new Date(service.created_at).toLocaleDateString()}</p>
                ${service.aparelhos ? `<p class="text-xs text-gray-400">${service.aparelhos.marca} - ${service.aparelhos.modelo}</p>` : ''}
            </div>
            <span class="font-semibold text-sm ${statusColor}">${service.status ? service.status.toUpperCase() : 'PENDENTE'}</span>
        `;
        clientHistoryList.appendChild(item);
    });
};

// Carregar Opções de Serviço do Catálogo
async function loadServiceOptions() {
    const select = document.getElementById('req-service-id');
    const priceDisplay = document.getElementById('estimated-price');
    const priceValue = document.getElementById('price-value');
    const priceList = document.getElementById('client-price-list');

    if (!select) return;

    // 1. Fetch Catalog
    const { data: services, error } = await window.supabaseClient
        .from('service_catalog')
        .select('*')
        .eq('active', true)
        .order('name');

    if (error) return;

    // Populate Select
    select.innerHTML = '<option value="">Selecione um Serviço...</option>';
    services.forEach(svc => {
        const option = document.createElement('option');
        option.value = svc.id;
        option.textContent = svc.name;
        option.dataset.price = svc.price;
        select.appendChild(option);
    });

    // Populate Side List
    if (priceList) {
        priceList.innerHTML = '';
        services.forEach(svc => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-start border-b border-gray-100 pb-2 mb-2 last:border-0 last:mb-0';
            div.innerHTML = `
                <div>
                    <div class="font-medium text-gray-800">${svc.name}</div>
                    ${svc.description ? `<div class="text-xs text-gray-500 mt-0.5">${svc.description}</div>` : ''}
                </div>
                <span class="font-bold text-blue-600 whitespace-nowrap ml-4">R$ ${svc.price}</span>
            `;
            priceList.appendChild(div);
        });
    }

    // Change Listener for Price Estimate
    select.addEventListener('change', (e) => {
        const opt = select.options[select.selectedIndex];
        if (opt.value) {
            priceDisplay.classList.remove('hidden');
            priceValue.textContent = parseFloat(opt.dataset.price).toFixed(2).replace('.', ',');
        } else {
            priceDisplay.classList.add('hidden');
        }
    });
}

// Injetar o carregamento do catálogo no loadClientDashboard
const originalLoadClientDashboard = window.loadClientDashboard;
window.loadClientDashboard = async () => {
    await originalLoadClientDashboard(); // Carrega histórico
    loadServiceOptions(); // Carrega opções
};


// Solicitar Serviço + WhatsApp (Atualizado)
if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const select = document.getElementById('req-service-id');
        const selectedOpt = select.options[select.selectedIndex];

        if (!select.value) {
            alert("Selecione um serviço.");
            return;
        }

        const serviceName = selectedOpt.text;
        const estPrice = selectedOpt.dataset.price;

        const brand = document.getElementById('req-brand').value;
        const model = document.getElementById('req-model').value;
        const notes = document.getElementById('req-notes').value;

        // 1. Garantir que exite um "Cliente" na tabela clientes (vínculo para o aparelho)
        const user = authState.user;
        const profile = authState.profile;

        // Buscamos se já existe um cliente vinculado a este user_id
        let { data: clientRecord } = await window.supabaseClient
            .from('clientes')
            .select('id')
            .eq('user_id', user.id)
            .single();

        let clienteId = clientRecord?.id;

        // Se não existir, criamos agora (sincronizando com o Profile)
        if (!clienteId) {
            const { data: newClient, error: clientErr } = await window.supabaseClient
                .from('clientes')
                .insert([{
                    nome: profile.nome || 'Cliente App',
                    whatsapp: profile.telefone || '',
                    endereco: profile.endereco || '',
                    user_id: user.id
                }])
                .select()
                .single();

            if (clientErr) {
                console.error("Erro criacao cliente:", clientErr);
                alert("Erro interno ao vincular cliente. Tente novamente.");
                return;
            }
            clienteId = newClient.id;
        }

        // 2. Aparelho (Agora com ID válido de cliente)
        const { data: aparelho, error: apError } = await window.supabaseClient
            .from('aparelhos')
            .insert([{
                cliente_id: clienteId, // ID válido obrigatório
                marca: brand,
                modelo: model,
                tipo: 'split'
            }])
            .select()
            .single();

        if (apError) {
            alert("Erro ao registrar aparelho. Tente novamente.");
            return;
        }

        // 2. Serviço
        const { error: servError } = await window.supabaseClient
            .from('servicos')
            .insert([{
                aparelho_id: aparelho.id,
                tipo: serviceName, // Salvando o Nome por enquanto para compatibilidade com sistema antigo
                cliente_profile_id: user.id,
                observacoes: notes + ` (Preço Est: R$ ${estPrice})`,
                status: 'pendente'
            }]);

        if (servError) {
            alert("Erro ao solicitar serviço: " + servError.message);
            return;
        }

        // 3. WhatsApp
        // const profile = authState.profile; // REMOVIDO: Já declarado acima
        const phone = COMPANY_WHATSAPP;

        const message = `Olá! Sou *${profile.nome}*. 
Gostaria de solicitar: *${serviceName}*.
Valor Estimado: *R$ ${estPrice}*.
Aparelho: ${brand} ${model}.
Obs: ${notes}.
Endereço: ${profile.endereco || 'Não informado'}.`;

        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        window.open(whatsappUrl, '_blank');
        alert("Solicitação registrada! Abrindo WhatsApp...");
        requestForm.reset();
        document.getElementById('estimated-price').classList.add('hidden');
        window.loadClientDashboard();
    });
}
