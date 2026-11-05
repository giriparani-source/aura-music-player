import fs from 'fs';
import path from 'path';

function createTaggedTrack(sourceMp3, targetPath, title, artist, album) {
  const data = fs.readFileSync(sourceMp3);
  
  // Check if ID3v2 exists at start
  let audioStart = 0;
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
    const id3v2Size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9];
    audioStart = 10 + id3v2Size;
  }
  
  // Extract roughly 500KB of audio data (around 30-40 seconds of valid audio)
  const audioData = data.subarray(audioStart, audioStart + 500000);
  
  // Create standard ID3v1 tag (128 bytes)
  const id3v1 = Buffer.alloc(128, 0);
  id3v1.write('TAG', 0, 3, 'latin1');
  id3v1.write(title.slice(0, 30), 3, 30, 'latin1');
  id3v1.write(artist.slice(0, 30), 33, 30, 'latin1');
  id3v1.write(album.slice(0, 30), 63, 30, 'latin1');
  id3v1.write('2026', 93, 4, 'latin1');
  id3v1.write('Aura test comment', 97, 28, 'latin1');
  id3v1[125] = 0;
  id3v1[126] = 1; // track 1
  id3v1[127] = 12; // genre
  
  const finalBuffer = Buffer.concat([audioData, id3v1]);
  fs.writeFileSync(targetPath, finalBuffer);
  console.log(`Created ${targetPath} (${finalBuffer.length} bytes)`);
}

const source = 'g:/My Drive/songs 1/Party & Kuthu Tracks/14 Kalyanam Aidicha.mp3';
createTaggedTrack(source, 'd:/music player/scripts/Test_Incremental_Track_1.mp3', 'Test Incremental Track 1', 'Aura QA Tester', 'Aura Test Suite');
createTaggedTrack(source, 'd:/music player/scripts/Test_Incremental_Track_2.mp3', 'Test Incremental Track 2', 'Aura QA Tester', 'Aura Test Suite');
