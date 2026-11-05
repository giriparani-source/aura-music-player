async function inspectInnerTubePlaylist() {
  console.log('Querying YouTube official InnerTube API for playlist PLNf1vclGjpRE...');
  const playlistId = 'PLNf1vclGjpRE';
  const browseId = `VL${playlistId}`;

  const payload = {
    context: {
      client: {
        clientName: 'WEB_REMIX',
        clientVersion: '1.20240101.01.00',
        hl: 'en',
        gl: 'IN'
      }
    },
    browseId
  };

  const res = await fetch('https://music.youtube.com/youtubei/v1/browse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'X-YouTube-Client-Name': '67',
      'X-YouTube-Client-Version': '1.20240101.01.00',
      'Referer': 'https://music.youtube.com/'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  let tracks = [];
  function extractTracks(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const renderer = item.musicResponsiveListItemRenderer;
      if (renderer) {
        const videoId = renderer.playlistItemData?.videoId;
        const titleRun = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.title?.runs?.[0]?.text;
        const artistRun = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.title?.runs?.[0]?.text;
        tracks.push({
          index: tracks.length + 1,
          videoId,
          title: titleRun,
          artist: artistRun
        });
      }
    }
  }

  // Navigate twoColumnBrowseResultsRenderer
  const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs;
  const tabContent = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
  let section = null;
  if (Array.isArray(tabContent)) {
    for (const c of tabContent) {
      if (c.musicPlaylistShelfRenderer) {
        section = c.musicPlaylistShelfRenderer;
        break;
      }
    }
  }

  // Also check secondaryContents
  const secondary = data.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents?.[0]?.musicPlaylistShelfRenderer;
  const targetShelf = section || secondary;

  if (targetShelf) {
    extractTracks(targetShelf.contents);
    console.log(`Initial batch extracted: ${tracks.length} tracks.`);

    let continuation = targetShelf.continuations?.[0]?.nextContinuationData?.continuation;
    let page = 1;
    while (continuation && page < 10) {
      page++;
      const contRes = await fetch(`https://music.youtube.com/youtubei/v1/browse?continuation=${continuation}&ctoken=${continuation}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': '67',
          'X-YouTube-Client-Version': '1.20240101.01.00',
          'Referer': 'https://music.youtube.com/'
        },
        body: JSON.stringify(payload)
      });
      const contData = await contRes.json();
      const contSection = contData.continuationContents?.musicPlaylistShelfContinuation;
      if (contSection) {
        extractTracks(contSection.contents);
        continuation = contSection.continuations?.[0]?.nextContinuationData?.continuation;
        console.log(`Page ${page} extracted. Total tracks so far: ${tracks.length}`);
      } else {
        break;
      }
    }
  } else {
    console.log('targetShelf not found directly. Checking JSON structure...');
    const str = JSON.stringify(data);
    const videoIdMatches = [...str.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    console.log('Total videoId occurrences in initial response:', videoIdMatches.length);
  }

  console.log(`\nYouTube Music Ground Truth: ${tracks.length} track entries.`);
  return tracks;
}

inspectInnerTubePlaylist().catch(console.error);
