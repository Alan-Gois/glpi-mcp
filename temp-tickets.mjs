import dotenv from 'dotenv';
dotenv.config();

const url = process.env.GLPI_URL;
const appToken = process.env.GLPI_APP_TOKEN;
const userToken = process.env.GLPI_USER_TOKEN;

async function fetchMyTickets() {
    const initRes = await fetch(`${url}/initSession`, {
        headers: {
            "Content-Type": "application/json",
            "App-Token": appToken,
            "Authorization": `user_token ${userToken}`,
        }
    });

    const { session_token } = await initRes.json();

    const headers = {
        "Content-Type": "application/json",
        "App-Token": appToken,
        "Session-Token": session_token
    };

    const sessionRes = await fetch(`${url}/getFullSession`, { headers });
    const session = await sessionRes.json();
    const userId = session.session.glpiID;

    // Search where requester (field 4) equals user ID, descending order by date_mod (15 is field ID for date_mod)
    const searchUrl = `${url}/search/Ticket?criteria[0][field]=4&criteria[0][searchtype]=equals&criteria[0][value]=${userId}&range=0-2&sort=15&order=DESC&forcedisplay=1,2,12,15,7,3,21`;
    const searchRes = await fetch(searchUrl, { headers });
    const searchData = await searchRes.json();

    console.log(JSON.stringify(searchData.data || searchData, null, 2));

    // Also try GET /Ticket if search fails
    if (!searchRes.ok || !searchData.data) {
        const listRes = await fetch(`${url}/Ticket?range=0-2&order=DESC&sort=date_mod`, { headers });
        const listData = await listRes.json();
        console.log("List fallback:", JSON.stringify(listData, null, 2));
    }
}

fetchMyTickets().catch(console.error);
