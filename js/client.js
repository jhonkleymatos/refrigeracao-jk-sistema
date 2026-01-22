// Lógica da Área do Cliente

const clientHistoryList = document.getElementById('client-history-list');
const requestForm = document.getElementById('request-form');

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

// Solicitar Serviço + WhatsApp
if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = document.getElementById('req-type').value;
        const brand = document.getElementById('req-brand').value;
        const model = document.getElementById('req-model').value;
        const notes = document.getElementById('req-notes').value;

        // 1. Cadastrar Aparelho (Simplificado: Cria um novo para cada pedido, ideal seria selecionar existente)
        const user = authState.user;

        // Criar aparelho
        const { data: aparelho, error: apError } = await window.supabaseClient
            .from('aparelhos')
            .insert([{
                cliente_id: null, // Campo legacy, se puder remover depois
                marca: brand,
                modelo: model,
                tipo: 'split', // Default por enquanto
                // Para simplificar, não estamos ligando o aparelho ao profile ainda na tabela 'aparelhos', 
                // mas vamos ligar o serviço ao profile.
            }])
            .select()
            .single();

        if (apError) {
            console.error("Erro aparelho:", apError);
            alert("Erro ao registrar aparelho.");
            return;
        }

        // 2. Criar Serviço Pendente
        const { error: servError } = await window.supabaseClient
            .from('servicos')
            .insert([{
                aparelho_id: aparelho.id,
                tipo: type,
                cliente_profile_id: user.id,
                observacoes: notes,
                status: 'pendente'
            }]);

        if (servError) {
            console.error("Erro serviço:", servError);
            alert("Erro ao solicitar serviço.");
            return;
        }

        // 3. Montar Link do WhatsApp
        // Pegar dados do profile para a mensagem
        const profile = authState.profile;
        const phone = '5511999999999'; // Substitua pelo SEU número de TÉCNICO

        const message = `Olá! Sou *${profile.nome}*. 
Gostaria de solicitar um serviço de *${type}*.
Aparelho: ${brand} ${model}.
Obs: ${notes}.
Endereço: ${profile.endereco || 'Não informado'}.`;

        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        // Abrir WhatsApp
        window.open(whatsappUrl, '_blank');

        alert("Solicitação registrada! Redirecionando para o WhatsApp...");
        requestForm.reset();
        window.loadClientDashboard();
    });
}
