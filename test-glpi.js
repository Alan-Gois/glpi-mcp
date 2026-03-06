require('dotenv').config();

async function testConnection() {
    const url = process.env.GLPI_URL;
    const userToken = process.env.GLPI_USER_TOKEN;
    const appToken = process.env.GLPI_APP_TOKEN;

    console.log(`📡 Connecting to GLPI at: ${url}`);

    try {
        // 1. Initialize Session
        const initResponse = await fetch(`${url}/initSession`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `user_token ${userToken}`,
                'App-Token': appToken
            }
        });

        if (!initResponse.ok) {
            console.error("❌ Authentication Failed!");
            console.error("Status:", initResponse.status);
            console.error("Response:", await initResponse.text());
            return;
        }

        const { session_token } = await initResponse.json();
        console.log("✅ Authenticated successfully! Session Token received.");

        // 2. Fetch Active Tickets
        const ticketResponse = await fetch(`${url}/Ticket?range=0-5`, {
            headers: {
                'Content-Type': 'application/json',
                'Session-Token': session_token,
                'App-Token': appToken
            }
        });

        if (!ticketResponse.ok) {
            console.warn("⚠️ Failed to fetch tickets:", await ticketResponse.text());
            return;
        }

        const tickets = await ticketResponse.json();
        console.log("\n📋 Last Active Tickets Found:");

        if (Array.isArray(tickets) && tickets.length > 0) {
            tickets.forEach(t => {
                console.log(` - ID: #${t.id} | Title: ${t.name}`);
            });
            console.log(`\n✅ Read access is working properly.\n`);
        } else {
            console.log("No tickets found, but API is accessible!");
        }

        // 3. Kill Session
        await fetch(`${url}/killSession`, {
            headers: {
                'Session-Token': session_token,
                'App-Token': appToken
            }
        });

    } catch (err) {
        console.error("❌ Network or Execution Error:", err.message);
    }
}

testConnection();
