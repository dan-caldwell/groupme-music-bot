const axios = require('axios');

async function getMessages() {
  const limit = Math.floor(new Date('2023-12-30').getTime() / 1000);
  let lastId = {
    id: null,
    created_at: Math.floor(new Date().getTime() / 1000),
  }
  while (lastId.created_at > limit) {
    console.log({
      lastId,
      limit
    });
    let url = `https://api.groupme.com/v3/groups/36338594/messages?token=${process.env.GROUPME_TOKEN}&limit=100`;
    if (lastId.id) url += `&before_id=${lastId.id}`;
    const { data } = await axios.get(url);
    const { messages } = data.response;
    // console.dir(data, { depth: null });
    const last = messages[messages.length - 1];
    lastId = {
      id: last.id,
      created_at: last.created_at,
    }
    console.dir(last, { depth: null });
  }
}

getMessages();