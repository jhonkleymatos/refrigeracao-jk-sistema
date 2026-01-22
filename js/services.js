// Gerenciamento de Serviços e Upload

const serviceForm = document.getElementById('service-form');
const clientSelect = document.getElementById('client-select');
const applianceSelect = document.getElementById('appliance-select');

// Carregar Clientes para o Select
async function loadClients() {
    const { data: clients, error } = await window.supabaseClient
        .from('clientes')
        .select('id, nome');

    if (error) {
        console.error('Erro ao buscar clientes:', error);
        return;
    }

    clientSelect.innerHTML = '<option value="">Selecione um Cliente</option>';
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.nome;
        clientSelect.appendChild(option);
    });
}

// Carregar Aparelhos quando Cliente é selecionado
async function loadAppliances(clientId) {
    const { data: appliances, error } = await window.supabaseClient
        .from('aparelhos')
        .select('id, marca, modelo, tipo')
        .eq('cliente_id', clientId);

    if (error) {
        console.error('Erro ao buscar aparelhos:', error);
        return;
    }

    applianceSelect.innerHTML = '<option value="">Selecione um Aparelho</option>';
    appliances.forEach(app => {
        const option = document.createElement('option');
        option.value = app.id;
        option.textContent = `${app.marca} - ${app.modelo} (${app.tipo})`;
        applianceSelect.appendChild(option);
    });
    applianceSelect.disabled = false;
}

// Listeners de Seleção
if (clientSelect) {
    clientSelect.addEventListener('change', (e) => {
        const clientId = e.target.value;
        if (clientId) {
            loadAppliances(clientId);
        } else {
            applianceSelect.innerHTML = '<option value="">Selecione um Cliente primeiro</option>';
            applianceSelect.disabled = true;
        }
    });
}

// Submissão do Formulário de Serviço
if (serviceForm) {
    serviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const applianceId = applianceSelect.value;
        const type = document.getElementById('service-type').value;
        const date = document.getElementById('service-date').value;
        const price = document.getElementById('service-price').value;
        const notes = document.getElementById('service-notes').value;
        const photoInput = document.getElementById('service-photos');
        const files = photoInput.files;

        if (!applianceId) {
            alert('Selecione um aparelho.');
            return;
        }

        // 1. Criar o Serviço
        const { data: service, error: serviceError } = await window.supabaseClient
            .from('servicos')
            .insert([{
                aparelho_id: applianceId,
                tipo: type,
                data_execucao: date,
                valor: price,
                observacoes: notes
            }])
            .select()
            .single();

        if (serviceError) {
            alert('Erro ao criar serviço: ' + serviceError.message);
            return;
        }

        const serviceId = service.id;
        console.log('Serviço criado:', serviceId);

        // 2. Upload de Fotos
        if (files.length > 0) {
            let uploadCount = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${serviceId}/${Math.random()}.${fileExt}`;
                const filePath = `${fileName}`;

                // Upload para Storage
                const { error: uploadError } = await window.supabaseClient
                    .storage
                    .from('servicos-fotos')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error('Erro no upload:', uploadError);
                    continue; // Pula para a próxima foto
                }

                // Obter URL Pública
                const { data: { publicUrl } } = window.supabaseClient
                    .storage
                    .from('servicos-fotos')
                    .getPublicUrl(filePath);

                // Salvar na tabela fotos_servico
                const { error: dbError } = await window.supabaseClient
                    .from('fotos_servico')
                    .insert([{
                        servico_id: serviceId,
                        url_foto: publicUrl,
                        nome_arquivo: fileName
                    }]);

                if (!dbError) uploadCount++;
            }
            alert(`Serviço registrado com sucesso! ${uploadCount} fotos enviadas.`);
        } else {
            alert('Serviço registrado com sucesso (sem fotos).');
        }

        // Resetar form
        serviceForm.reset();
        // Opcional: Atualizar galeria se estiver visível
        if (typeof loadGallery === 'function') loadGallery();
    });
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    // Carregar clientes apenas se estiver logado (será tratado pelo auth.js ou verificação aqui)
    // Pequeno delay ou verificar sessão
    if (clientSelect) loadClients();
});
