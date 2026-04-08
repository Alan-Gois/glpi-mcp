import dotenv from 'dotenv';
import { GlpiClient } from './src/services/glpi-client';

dotenv.config({ override: true });

async function runLiveTest() {
    const url = process.env.GLPI_URL;
    const userToken = process.env.GLPI_USER_TOKEN?.trim();
    const appToken = process.env.GLPI_APP_TOKEN?.trim();
    const apiVersion = 10;

    if (!url || !userToken || !appToken) {
        console.error("Faltam variáveis no .env (GLPI_URL, GLPI_USER_TOKEN ou GLPI_APP_TOKEN)");
        process.exit(1);
    }

    console.log(`Conectando em ${url} (API v10) apenas com Chaves de Acesso (UserToken e AppToken)...`);
    const client = new GlpiClient({
        url,
        apiVersion,
        userToken,
        appToken
    });

    try {
        await client.initSession();
        console.log("✅ Sessão iniciada com sucesso!");

        console.log("📝 Criando um novo chamado...");
        const ticketResult = await client.createTicket({
            name: "[TESTE] Chamado criado via GLPI MCP Server",
            content: "Este é um chamado de teste automatizado para validar a funcionalidade de criação e atualização de chamados da integração MCP usando credenciais.",
            priority: 3, // Média
            urgency: 3
        });
        
        const ticketId = ticketResult.id;
        console.log(`✅ Chamado criado com sucesso! ID do chamado: ${ticketId}`);

        console.log("✏️ Atualizando o chamado para prioridade Alta...");
        await client.updateTicket(ticketId, {
            priority: 4 // Alta
        });
        console.log("✅ Chamado atualizado com sucesso!");

        console.log("💬 Adicionando um acompanhamento (Followup)...");
        await client.addFollowup(ticketId, "Acompanhamento de teste adicionado via código com sucesso.", true);
        console.log("✅ Acompanhamento inserido!");

        console.log("🛠️ Inserindo Solução no chamado...");
        await client.addSolution(ticketId, "Esta é a solução técnica automatizada inserida pelo script de teste. O problema foi resolvido com sucesso.");
        console.log("✅ Solução inserida (Status alterado para Solucionado/5)!");

        console.log("🔒 Fechando (Aceitando) o chamado...");
        await client.updateTicket(ticketId, {
            status: 6 // 6 = Fechado (Closed)
        });
        console.log("✅ Chamado Fechado/Aceito definitivamente!");

        console.log(`🎉 TESTE FINALIZADO COMPLETO! Verifique o chamado ID #${ticketId} no seu GLPI (Ele deve estar na aba de Fechados/Solucionados).`);
    } catch (err: any) {
        console.error("❌ Erro durante o teste:", err.message);
    } finally {
        await client.killSession();
    }
}

runLiveTest();
