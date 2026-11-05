async function testWithHeaders() {
  const url = 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://open.spotify.com/',
    'Origin': 'https://open.spotify.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  };

  const res = await fetch(url, { headers });
  console.log('Status with headers:', res.status);
  const text = await res.text();
  console.log('Response preview:', text.substring(0, 300));
}
testWithHeaders();
