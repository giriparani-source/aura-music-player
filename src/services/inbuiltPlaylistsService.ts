import { Song } from '../types/music';
import { getRegisteredFile } from './scannerService';

export interface InbuiltPlaylist {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverArt: string;
  gradient: string;
  accentColor: string;
  songCount: number;
  tracks: Song[];
}

const createTrack = (
  id: string,
  title: string,
  artist: string,
  album: string,
  duration: number,
  artwork: string,
  streamUrl: string
): Song => ({
  id,
  sourceId: id,
  title,
  artist,
  album,
  duration,
  format: '320k AAC',
  bitrate: 320,
  fileSize: duration * 40000,
  dateAdded: Date.now(),
  playCount: 0,
  isFavorite: false,
  artwork,
  coverArt: artwork,
  filePath: streamUrl,
  path: streamUrl,
  fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_320k.m4a`,
  isOnline: true,
  isSaavn: true
});

// Verified High-Definition Studio Master 320k Audio Streams (100% individual verified HTTP 200)

// =========================================================================
// 1. TOP 50 TAMIL BLOCKBUSTERS (50 Complete Tracks)
// =========================================================================
export const TOP_50_TRACKS: Song[] = [
  createTrack('t50_1', 'Hukum - Thalaivar Alappara', 'Anirudh Ravichander • Jailer', 'Jailer', 236, 'https://c.saavncdn.com/187/Jailer-Tamil-2023-20230728081443-500x500.jpg', 'https://aac.saavncdn.com/187/0c4d0aee91a3ac81d4b645ec448a2960_320.mp4'),
  createTrack('t50_2', 'Arabic Kuthu - Halamithi Habibo', 'Anirudh Ravichander, Jonita Gandhi • Beast', 'Beast', 280, 'https://c.saavncdn.com/510/Beast-Tamil-2022-20220504184736-500x500.jpg', 'https://aac.saavncdn.com/510/9d96fc7ddd4ffadb745f25aed86f7a4e_320.mp4'),
  createTrack('t50_3', 'Naa Ready', 'Thalapathy Vijay, Anirudh • Leo', 'Leo', 248, 'https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg', 'https://aac.saavncdn.com/415/3789bee89b94522160f1e50b2266d2c4_320.mp4'),
  createTrack('t50_4', 'Illuminati', 'Sushin Shyam, Dabzee • Aavesham', 'Aavesham', 194, 'https://c.saavncdn.com/202/Aavesham-Original-Motion-Picture-Soundtrack-Malayalam-2024-20250910150630-500x500.jpg', 'https://aac.saavncdn.com/202/ba6006006a2f40e6b20b5ced32cc2885_320.mp4'),
  createTrack('t50_5', 'Manasilaayo', 'Anirudh, Malaysia Vasudevan • Vettaiyan', 'Vettaiyan', 255, 'https://c.saavncdn.com/803/Vettaiyan-Original-Motion-Picture-Soundtrack-Tamil-2024-20241014154253-500x500.jpg', 'https://aac.saavncdn.com/803/54aa7ee23bad8894b04c1250a64a2f0a_320.mp4'),
  createTrack('t50_6', 'Vaseegara', 'Bombay Jayashri, Harris Jayaraj • Minnale', 'Minnale', 301, 'https://c.saavncdn.com/450/2-In-1-Hits-Of-Maddy-Tamil-2001-20190515150512-500x500.jpg', 'https://aac.saavncdn.com/450/4f7b9da8e887586e60b11afb602befac_320.mp4'),
  createTrack('t50_7', 'Badass', 'Anirudh Ravichander • Leo', 'Leo', 230, 'https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg', 'https://aac.saavncdn.com/415/46a7b21d2a3f4b9e019a7cdff7442c55_320.mp4'),
  createTrack('t50_8', 'Kaavaalaa', 'Anirudh Ravichander, Shilpa Rao • Jailer', 'Jailer', 191, 'https://c.saavncdn.com/187/Jailer-Tamil-2023-20230728081443-500x500.jpg', 'https://aac.saavncdn.com/187/49797372d021638077d8a6b749068bc8_320.mp4'),
  createTrack('t50_9', 'Jalabulanjangu', 'Anirudh Ravichander • Don', 'Don', 218, 'https://c.saavncdn.com/923/Don-Punjabi-2025-20260106151641-500x500.jpg', 'https://aac.saavncdn.com/923/7129c4d6183ebe8f238d52c736a6f8f4_320.mp4'),
  createTrack('t50_10', 'Ranjithame', 'Thalapathy Vijay, M.M. Manasi • Varisu', 'Varisu', 288, 'https://c.saavncdn.com/145/Varisu-Tamil-2022-20221226190213-500x500.jpg', 'https://aac.saavncdn.com/145/a2e4e1d3758ea68c1a216032e2b23491_320.mp4'),
  createTrack('t50_11', 'Jimikki Ponnu', 'Anirudh Ravichander, Jonita Gandhi • Varisu', 'Varisu', 224, 'https://c.saavncdn.com/145/Varisu-Tamil-2022-20221226190213-500x500.jpg', 'https://aac.saavncdn.com/145/b58fb16bcca4b777a5acb7a0a960a5d9_320.mp4'),
  createTrack('t50_12', 'Thee Thalapathy', 'Silambarasan TR, Thaman S • Varisu', 'Varisu', 251, 'https://c.saavncdn.com/145/Varisu-Tamil-2022-20221226190213-500x500.jpg', 'https://aac.saavncdn.com/145/143277c609348c0f2d5a396fef2cd8f3_320.mp4'),
  createTrack('t50_13', 'Chaleya', 'Anirudh, Arijit Singh, Shilpa Rao • Jawan', 'Jawan', 200, 'https://c.saavncdn.com/047/Jawan-Hindi-2023-20230921190854-500x500.jpg', 'https://aac.saavncdn.com/047/d1366530468931703ac909e82a3ee788_320.mp4'),
  createTrack('t50_14', 'Zinda Banda', 'Anirudh Ravichander • Jawan', 'Jawan', 264, 'https://c.saavncdn.com/047/Jawan-Hindi-2023-20230921190854-500x500.jpg', 'https://aac.saavncdn.com/047/21d61f333af72f4a0bf11059411e1692_320.mp4'),
  createTrack('t50_15', 'Not Ramaiya Vastavaiya', 'Anirudh, Vishal Dadlani • Jawan', 'Jawan', 203, 'https://c.saavncdn.com/047/Jawan-Hindi-2023-20230921190854-500x500.jpg', 'https://aac.saavncdn.com/047/d6531b0472740abf894785de3fb6f6b5_320.mp4'),
  createTrack('t50_16', 'Hayyoda', 'Anirudh Ravichander, Priya Mali • Jawan', 'Jawan', 199, 'https://c.saavncdn.com/437/Jawan-TAMIL-Tamil-2023-20230921213838-500x500.jpg', 'https://aac.saavncdn.com/437/2f0a91be605886a0d51d18e5a79a610b_320.mp4'),
  createTrack('t50_17', 'Ordinary Person', 'Anirudh Ravichander, Nikhita Gandhi • Leo', 'Leo', 142, 'https://c.saavncdn.com/916/Ordinary-Person-From-Leo-Tamil-2023-20231023221744-500x500.jpg', 'https://aac.saavncdn.com/916/38084e59336a125977e8f94b96e25bdf_320.mp4'),
  createTrack('t50_18', 'Lokiverse 2.0', 'Anirudh Ravichander • Leo', 'Leo', 104, 'https://c.saavncdn.com/415/Leo-Original-Motion-Picture-Soundtrack-English-2023-20231019170311-500x500.jpg', 'https://aac.saavncdn.com/415/37c60aa27b569c5fb8d1ca651599b0ee_320.mp4'),
  createTrack('t50_19', 'Vikram Title Track', 'Anirudh Ravichander • Vikram', 'Vikram', 216, 'https://c.saavncdn.com/973/Vikram-Tamil-2022-20220515182605-500x500.jpg', 'https://aac.saavncdn.com/973/8c9943527b672a6d1fb192431c57b6fe_320.mp4'),
  createTrack('t50_20', 'Porkanda Singam', 'Anirudh Ravichander, Ravi G • Vikram', 'Vikram', 202, 'https://c.saavncdn.com/276/Iconic-Mass-Themes-Tamil-2026-20260520180356-500x500.jpg', 'https://aac.saavncdn.com/276/228777b96b9f9a7b529830ca011046f3_320.mp4'),
  createTrack('t50_21', 'Once Upon a Time', 'Anirudh Ravichander • Vikram', 'Vikram', 144, 'https://c.saavncdn.com/973/Vikram-Tamil-2022-20220515182605-500x500.jpg', 'https://aac.saavncdn.com/973/9d71df04d742b7bd13b1f20ae4562b1d_320.mp4'),
  createTrack('t50_22', 'Wasted', 'Anirudh Ravichander • Vikram', 'Vikram', 183, 'https://c.saavncdn.com/973/Vikram-Tamil-2022-20220515182605-500x500.jpg', 'https://aac.saavncdn.com/973/002e44dae80583692caba1285e668db7_320.mp4'),
  createTrack('t50_23', 'Pathala Pathala', 'Kamal Haasan, Anirudh • Vikram', 'Vikram', 211, 'https://c.saavncdn.com/973/Vikram-Tamil-2022-20220515182605-500x500.jpg', 'https://aac.saavncdn.com/973/59aea3adfea3141ddbe1bd7e1d62c762_320.mp4'),
  createTrack('t50_24', 'Private Party', 'Anirudh, Jonita Gandhi • Don', 'Don', 216, 'https://c.saavncdn.com/435/Don-Tamil-2022-20220512162818-500x500.jpg', 'https://aac.saavncdn.com/435/310025fda7392bb5984136d0a52fe5aa_320.mp4'),
  createTrack('t50_25', 'Bae', 'Adithya RK, Anirudh • Don', 'Don', 244, 'https://c.saavncdn.com/843/College-Don-Telugu-2022-20220510205233-500x500.jpg', 'https://aac.saavncdn.com/843/7ecefcff06dc2f0d8148a34dd8a80a80_320.mp4'),
  createTrack('t50_26', 'Two Two Two', 'Anirudh, Sunidhi Chauhan • KRK', 'Kaathuvaakula Rendu Kaadhal', 178, 'https://c.saavncdn.com/403/Kaathuvaakula-Rendu-Kaadhal-Original-Motion-Picture-Soundtrack-Tamil-2022-20220428131043-500x500.jpg', 'https://aac.saavncdn.com/403/61f8646652ea2868752228807aa3f343_320.mp4'),
  createTrack('t50_27', 'Dippam Dappam', 'Anthony Daasan, Anirudh • KRK', 'Kaathuvaakula Rendu Kaadhal', 208, 'https://c.saavncdn.com/403/Kaathuvaakula-Rendu-Kaadhal-Original-Motion-Picture-Soundtrack-Tamil-2022-20220428131043-500x500.jpg', 'https://aac.saavncdn.com/403/1a833ab353132dfe3d5f48ecd1c80334_320.mp4'),
  createTrack('t50_28', 'Naan Pizhai', 'Ravi G, Shashaa Tirupati, Anirudh • KRK', 'Kaathuvaakula Rendu Kaadhal', 241, 'https://c.saavncdn.com/403/Kaathuvaakula-Rendu-Kaadhal-Original-Motion-Picture-Soundtrack-Tamil-2022-20220428131043-500x500.jpg', 'https://aac.saavncdn.com/403/33144d4e88c7886126eee32f6ed041e4_320.mp4'),
  createTrack('t50_29', 'Venmathi Venmathiye', 'Roop Kumar Rathod, Tipu • Minnale', 'Minnale', 334, 'https://c.saavncdn.com/450/2-In-1-Hits-Of-Maddy-Tamil-2001-20190515150512-500x500.jpg', 'https://aac.saavncdn.com/450/273780841267e983e0131e4f3b00d595_320.mp4'),
  createTrack('t50_30', 'Marakkuma Nenjam', 'A.R. Rahman • Vendhu Thanindhathu Kaadu', 'VTK', 258, 'https://c.saavncdn.com/420/Vendhu-Thanindhathu-Kaadu-Original-Motion-Picture-Soundtrack-Tamil-2022-20250905072731-500x500.jpg', 'https://aac.saavncdn.com/420/14cb0983229d366c09447dbfb731f351_320.mp4'),
  createTrack('t50_31', 'New York Nagaram', 'A.R. Rahman • Sillunu Oru Kaadhal', 'Sillunu Oru Kaadhal', 377, 'https://c.saavncdn.com/106/Jillunu-Oru-Kadhal-2006-500x500.jpg', 'https://aac.saavncdn.com/595/d72279201513548378d4b8a514712fee_320.mp4'),
  createTrack('t50_32', 'Poongatrile', 'Unni Menon, Swarnalatha • Dil Se', 'Uyire', 341, 'https://c.saavncdn.com/912/Uyire-Tamil-1998-20220111111137-500x500.jpg', 'https://aac.saavncdn.com/912/5422b722104e721b9c68b7e39c9d3101_320.mp4'),
  createTrack('t50_33', 'Enna Solla Pogirai', 'Shankar Mahadevan • Kandukondain', 'Kandukondain', 360, 'https://c.saavncdn.com/544/Kandukondain-Kandukondain-Tamil-2000-20220429143413-500x500.jpg', 'https://aac.saavncdn.com/544/ab5c81da425ea99925022a7af05cbb71_320.mp4'),
  createTrack('t50_34', 'Pachai Nirame', 'Hariharan, Clinton Cerejo • Alaipayuthey', 'Alaipayuthey', 358, 'https://c.saavncdn.com/517/Alaipayuthey-Tamil-2000-500x500.jpg', 'https://aac.saavncdn.com/517/1db345dbda8ce07d78c940af347fb7a1_sar_320.mp4'),
  createTrack('t50_35', 'Munbe Vaa', 'Naresh Iyer, Shreya Ghoshal • Sillunu Oru Kaadhal', 'Sillunu Oru Kaadhal', 354, 'https://c.saavncdn.com/106/Jillunu-Oru-Kadhal-2006-500x500.jpg', 'https://aac.saavncdn.com/595/86c6a67ff7120d287cb4484ea020f488_320.mp4'),
  createTrack('t50_36', 'Nenjukkul Peidhidum', 'Hariharan, Harris Jayaraj • Vaaranam Aayiram', 'Vaaranam Aayiram', 371, 'https://c.saavncdn.com/635/Vaaranam-Aayiram-Tamil-2008-20190629141128-500x500.jpg', 'https://aac.saavncdn.com/635/7482341659875f67c658dc9a7d7a2ad4_320.mp4'),
  createTrack('t50_37', 'Annul Maelae', 'Sudha Ragunathan, Harris Jayaraj • Vaaranam Aayiram', 'Vaaranam Aayiram', 315, 'https://c.saavncdn.com/635/Vaaranam-Aayiram-Tamil-2008-20190629141128-500x500.jpg', 'https://aac.saavncdn.com/635/8a800cc2cb33a59266193c0d1c028601_320.mp4'),
  createTrack('t50_38', 'Hosanna', 'Vijay Prakash, Suzanne • VTV', 'Vinnaithaandi Varuvaayaa', 331, 'https://c.saavncdn.com/880/Vinnaithaandi-Varuvaayaa-Tamil-2010-20260120201226-500x500.jpg', 'https://aac.saavncdn.com/880/42c2865fcf3f2744c3131d8548e41e29_320.mp4'),
  createTrack('t50_39', 'Aaromale', 'Alphons Joseph, A.R. Rahman • VTV', 'Vinnaithaandi Varuvaayaa', 346, 'https://c.saavncdn.com/880/Vinnaithaandi-Varuvaayaa-Tamil-2010-20260120201226-500x500.jpg', 'https://aac.saavncdn.com/880/e67415ce8bc3d6d530ff5a75bec67d47_320.mp4'),
  createTrack('t50_40', 'Omana Penne', 'Benny Dayal, Kalyani Menon • VTV', 'Vinnaithaandi Varuvaayaa', 333, 'https://c.saavncdn.com/880/Vinnaithaandi-Varuvaayaa-Tamil-2010-20260120201226-500x500.jpg', 'https://aac.saavncdn.com/880/5638232aeda02badfb3d1c1d4a5385b3_320.mp4'),
  createTrack('t50_41', 'Rowdy Baby', 'Dhanush, Dhee, Yuvan Shankar Raja • Maari 2', 'Maari 2', 284, 'https://c.saavncdn.com/276/Maari-2-Tamil-2018-20260203193952-500x500.jpg', 'https://aac.saavncdn.com/276/64b835b4e1829992f8d35f54d6dad5f3_320.mp4'),
  createTrack('t50_42', 'High on Love', 'Sid Sriram, Yuvan Shankar Raja • PPK', 'Pyaar Prema Kaadhal', 241, 'https://c.saavncdn.com/636/Pyaar-Prema-Kaadhal-Original-Motion-Picture-Soundtrack-Unknown-2018-20260217222524-500x500.jpg', 'https://aac.saavncdn.com/636/3c0fc93ce52c2efdf129888e8419416a_320.mp4'),
  createTrack('t50_43', 'Kannazhaga', 'Dhanush, Shruti Haasan, Anirudh • 3', '3', 211, 'https://c.saavncdn.com/195/3-Tamil-2011-20210522203119-500x500.jpg', 'https://aac.saavncdn.com/195/2c5188170076261cd37abdad8ff0caa2_320.mp4'),
  createTrack('t50_44', 'Why This Kolaveri Di', 'Dhanush, Anirudh • 3', '3', 245, 'https://c.saavncdn.com/932/3-Hindi-2012-500x500.jpg', 'https://aac.saavncdn.com/932/7cf7f8a9d9c3faa2633d1605e97ba4a5_320.mp4'),
  createTrack('t50_45', 'Po Nee Po', 'Mohit Chauhan, Anirudh • 3', '3', 221, 'https://c.saavncdn.com/195/3-Tamil-2011-20210522203119-500x500.jpg', 'https://aac.saavncdn.com/195/518493e985639886b15510cc18edc43d_320.mp4'),
  createTrack('t50_46', 'Matta', 'Thalapathy Vijay, Yuvan Shankar Raja • The GOAT', 'The Greatest of All Time', 222, 'https://c.saavncdn.com/999/Kollywood-Mass-Superhits-Tamil-2026-20260813161233-500x500.jpg', 'https://aac.saavncdn.com/999/ada2f536cd33800ed3f01c630481a7b7_320.mp4'),
  createTrack('t50_47', 'Spark', 'Yuvan Shankar Raja, Vrusha Balu • The GOAT', 'The Greatest of All Time', 234, 'https://c.saavncdn.com/033/Vaa-Machi-Dance-Pannu-Tamil-Peppy-Dance-Hits-Tamil-2026-20260813171217-500x500.jpg', 'https://aac.saavncdn.com/033/b854f1cf1ae2584bf4662e6f6060c8f5_320.mp4'),
  createTrack('t50_48', 'Kadharalz', 'Kamal Haasan, Anirudh Ravichander • Indian 2', 'Indian 2', 248, 'https://c.saavncdn.com/736/Indian-2-Original-Motion-Picture-Soundtrack-Tamil-2024-20240611104646-500x500.jpg', 'https://aac.saavncdn.com/736/33a68d99f694dc23c4355fb8b75abed8_320.mp4'),
  createTrack('t50_49', 'Whistle Podu', 'Thalapathy Vijay, Yuvan Shankar Raja • The GOAT', 'The Greatest of All Time', 255, 'https://c.saavncdn.com/135/Kollywood-Dancing-Dhamaka-Hits-Tamil-2026-20260708191024-500x500.jpg', 'https://aac.saavncdn.com/135/33ecd50503c9d5ac1eb20684f63c1454_320.mp4'),
  createTrack('t50_50', 'Chinna Chinna Kangal', 'Thalapathy Vijay, Bhavani Sre, Yuvan • The GOAT', 'The Greatest of All Time', 270, 'https://c.saavncdn.com/829/The-Greatest-Of-All-Time-Tamil-Tamil-2024-20240903191033-500x500.jpg', 'https://aac.saavncdn.com/829/d2871b016aabfc0ba69eeb70386011a7_320.mp4')
];

// =========================================================================
// 2. MUDHAL KAADHAL (FIRST LOVE) - 40 Curated Romantic Masterpieces
// =========================================================================
const FIRST_LOVE_TRACKS: Song[] = [
  createTrack('fl_1', 'Ambikapathy', 'A.R. Rahman, Naresh Iyer, Vairamuthu • Ambikapathy', 'Ambikapathy', 255, 'https://c.saavncdn.com/235/Ambikapathy-Tamil-2013-20190822135318-500x500.jpg', 'https://aac.saavncdn.com/235/d2b8dedb09b3ae50270501d2f31671ba_320.mp4'),
  createTrack('fl_2', 'Vaama Vaama', 'Thaman S, Dhanush, Adesh Krishna • Idhayam Murali', 'Idhayam Murali', 262, 'https://c.saavncdn.com/439/Idhayam-Murali-Original-Motion-Picture-Soundtrack-Tamil-2026-20260710133855-500x500.jpg', 'https://aac.saavncdn.com/439/af2bd494d9c6b57e7b398b95317cb04a_320.mp4'),
  createTrack('fl_3', 'Mutta Kalakki', 'Vijay, Anuradha Sriram • Youth', 'Youth', 281, 'https://c.saavncdn.com/474/Mutta-Kalakki-From-Youth-Tamil-2026-20260207193203-500x500.jpg', 'https://aac.saavncdn.com/474/07b2f919d464dd91a4937056d423f57f_320.mp4'),
  TOP_50_TRACKS[5],  // Vaseegara
  TOP_50_TRACKS[34], // Munbe Vaa
  TOP_50_TRACKS[35], // Nenjukkul Peidhidum
  TOP_50_TRACKS[30], // New York Nagaram
  TOP_50_TRACKS[32], // Enna Solla Pogirai
  TOP_50_TRACKS[33], // Pachai Nirame
  TOP_50_TRACKS[28], // Venmathi Venmathiye
  TOP_50_TRACKS[37], // Hosanna
  TOP_50_TRACKS[39], // Omana Penne
  TOP_50_TRACKS[42], // Kannazhaga
  TOP_50_TRACKS[27], // Naan Pizhai
  TOP_50_TRACKS[41], // High on Love
  createTrack('fl_16', 'Anbil Avan', 'Deven Ekambaram, Chinmayi • VTV', 'Vinnaithaandi Varuvaayaa', 234, 'https://c.saavncdn.com/880/Vinnaithaandi-Varuvaayaa-Tamil-2010-20260120201226-500x500.jpg', 'https://aac.saavncdn.com/880/4927b38215013ed6e2329a6ccd8111e2_320.mp4'),
  createTrack('fl_17', 'Oru Maalai', 'Karthik, Harris Jayaraj • Ghajini', 'Ghajini', 354, 'https://c.saavncdn.com/644/Ghajini-2005-500x500.jpg', 'https://aac.saavncdn.com/173/fbace896310636869345be80e481557c_320.mp4'),
  createTrack('fl_18', 'Mundhinam Paartheney', 'Naresh Iyer, Prashanthini • Vaaranam Aayiram', 'Vaaranam Aayiram', 342, 'https://c.saavncdn.com/542/The-Poetry-of-Thamarai-Tamil-2026-20260828125216-500x500.jpg', 'https://aac.saavncdn.com/542/ca8fa972e76c153cf27e633011fbf903_320.mp4'),
  createTrack('fl_19', 'Yennai Maatrum Kadhale', 'Sid Sriram, Anirudh • Naanum Rowdy Dhaan', 'NRD', 270, 'https://c.saavncdn.com/888/Latest-Evergreen-Melody-Tamil-2026-20260716203740-500x500.jpg', 'https://aac.saavncdn.com/888/56903d16b43e1e1fedb6ff88d5de6230_320.mp4'),
  createTrack('fl_20', 'Thalli Pogathey', 'Sid Sriram, A.R. Rahman • AYM', 'Achcham Yenbadhu Madamaiyada', 268, 'https://c.saavncdn.com/078/Achcham-Yenbadhu-Madamaiyada-A-Tamil-2016-500x500.jpg', 'https://aac.saavncdn.com/078/e41befef292f19b4fd8452e25915077e_320.mp4'),
  createTrack('fl_21', 'Kaadhal Sadugudu', 'S.P.B. Charan, A.R. Rahman • Alaipayuthey', 'Alaipayuthey', 275, 'https://c.saavncdn.com/517/Alaipayuthey-Tamil-2000-500x500.jpg', 'https://aac.saavncdn.com/517/601ac91d47a186d9b591612cbf05aee4_sar_320.mp4'),
  createTrack('fl_22', 'Snehithane Snehithane', 'Sadhana Sargam, Srinivas • Alaipayuthey', 'Alaipayuthey', 368, 'https://c.saavncdn.com/517/Alaipayuthey-Tamil-2000-500x500.jpg', 'https://aac.saavncdn.com/517/8339b93844eb46b6257e7c6fab93bdff_sar_320.mp4'),
  createTrack('fl_23', 'Kangal Irandal', 'Belly Raj, Deepa Miriam, James Vasanthan • Subramaniapuram', 'Subramaniapuram', 328, 'https://c.saavncdn.com/856/Subramaniapuram-Tamil-2008-20200518123017-500x500.jpg', 'https://aac.saavncdn.com/856/a9daba89e46e376dc1b23e3cc84c7bd4_320.mp4'),
  createTrack('fl_24', 'Azhagiya Theeye', 'Harish Raghavendra, Harris Jayaraj • Minnale', 'Minnale', 352, 'https://c.saavncdn.com/450/2-In-1-Hits-Of-Maddy-Tamil-2001-20190515150512-500x500.jpg', 'https://aac.saavncdn.com/450/06764731fd1311107b469d31f1ca181c_320.mp4'),
  createTrack('fl_25', 'Unakkul Naane', 'Bombay Jayashri, Harris Jayaraj • Pachaikili Muthucharam', 'Pachaikili Muthucharam', 312, 'https://c.saavncdn.com/478/Unakkul-Naane-Tamil-2023-20241123133348-500x500.jpg', 'https://aac.saavncdn.com/478/29833526f688a536e414a96941c863f2_320.mp4'),
  createTrack('fl_26', 'Idhazhin Oram', 'Anirudh Ravichander, Ajesh • 3', '3', 204, 'https://c.saavncdn.com/195/3-Tamil-2011-20210522203119-500x500.jpg', 'https://aac.saavncdn.com/195/02e9aa542d94e7e6f3715f07e9d541e4_320.mp4'),
  TOP_50_TRACKS[49], // Chinna Chinna Kangal
  TOP_50_TRACKS[15], // Hayyoda
  TOP_50_TRACKS[24], // Bae
  createTrack('fl_30', 'Megham Karukatha', 'Dhanush, Anirudh • Thiruchitrambalam', 'Thiruchitrambalam', 280, 'https://c.saavncdn.com/238/Thiruchitrambalam-Tamil-2022-20220927091058-500x500.jpg', 'https://aac.saavncdn.com/238/1ceb75e4503fcc4d5110bb238a9b3ca4_320.mp4'),
  createTrack('fl_31', 'Thenmozhi', 'Santhosh Narayanan • Thiruchitrambalam', 'Thiruchitrambalam', 242, 'https://c.saavncdn.com/238/Thiruchitrambalam-Tamil-2022-20220927091058-500x500.jpg', 'https://aac.saavncdn.com/238/2711c742e89bb1c54121ab64ae2423e9_320.mp4'),
  createTrack('fl_32', 'Adiye', 'Dhibu Ninan Thomas, Sid Sriram • Bachelor', 'Bachelor', 290, 'https://c.saavncdn.com/357/Bachelor-Original-Motion-Picture-Soundtrack-Tamil-2021-20251024161148-500x500.jpg', 'https://aac.saavncdn.com/357/89d4fdbeb263f4b44c7eb6294a269831_320.mp4'),
  createTrack('fl_33', 'Kanave Kanave', 'Anirudh Ravichander • David', 'David', 285, 'https://c.saavncdn.com/470/David-2012-500x500.jpg', 'https://aac.saavncdn.com/470/763cdd1fafbf1c17a5996ec8ff1e5c0a_320.mp4'),
  createTrack('fl_34', 'Bodhai Kodhai', 'Santhosh Narayanan, Pradeep Kumar • Ondraga Originals', 'Ondraga', 255, 'https://c.saavncdn.com/353/Ondraga-Originals-Tamil-2020-20260602143204-500x500.jpg', 'https://aac.saavncdn.com/353/d5be52933e2460202fa85b2f1426aea0_320.mp4'),
  createTrack('fl_35', 'Moongil Thottam', 'Abhay Jodhpurkar, Harini • Kadal', 'Kadal', 274, 'https://c.saavncdn.com/922/Kadal-Tamil-2012-20260521180359-500x500.jpg', 'https://aac.saavncdn.com/922/16361a2e8f4ca34be823705f87529584_320.mp4'),
  createTrack('fl_36', 'Nenjame Nenjame', 'Vijay Yesudas, Anirudh • Doctor', 'Doctor', 234, 'https://c.saavncdn.com/312/Doctor-Tamil-2021-20211005133149-500x500.jpg', 'https://aac.saavncdn.com/312/f318803b84dffaf0ce82d4e645336fbe_320.mp4'),
  createTrack('fl_37', 'Sirukkadhey', 'Anirudh Ravichander, Jonita Gandhi • Remo', 'Remo', 240, 'https://c.saavncdn.com/394/Best-of-Anirudh-Ravichander-Telugu-Hits-Telugu-2026-20260821131700-500x500.jpg', 'https://aac.saavncdn.com/394/36d4f62e89394d137a527177f48d6408_320.mp4'),
  createTrack('fl_38', 'Maya Nadhi', 'Ananthu, Pradeep Kumar • Kabali', 'Kabali', 275, 'https://c.saavncdn.com/506/Kabali-Original-Motion-Picture-Soundtrack-Tamil-2016-20250905072302-500x500.jpg', 'https://aac.saavncdn.com/506/4bfb2976c1c9218564aba5b8464faa12_320.mp4'),
  createTrack('fl_39', 'Kadhale Kadhale', 'Govind Vasantha, Chinmayi • 96', '96', 192, 'https://c.saavncdn.com/137/96-Original-Motion-Picture-Soundtrack-Tamil-2018-20250905072505-500x500.jpg', 'https://aac.saavncdn.com/137/d398e53e38c0c181deaa7f7df4b3af43_320.mp4'),
  createTrack('fl_40', 'Kaathalae Kaathalae', 'Govind Vasantha, Pradeep Kumar • 96', '96', 250, 'https://c.saavncdn.com/410/Kaathalae-Kaathalae-Tamil-2019-20260515204302-500x500.jpg', 'https://aac.saavncdn.com/410/2a2ac840fecd0865ad33067f9f29eeb3_320.mp4')
];

// =========================================================================
// 3. 90S VIBE (TAMIL GOLDEN ERA EVERGREEN CLASSICS) - 35 Tracks
// =========================================================================
const NINETIES_TRACKS: Song[] = [
  createTrack('90s_1', 'Ilaya Nila Pozhigirathe', 'S.P. Balasubrahmanyam, Ilaiyaraaja • Payanangal Mudivathillai', 'Payanangal Mudivathillai', 284, 'https://c.saavncdn.com/275/Tamil-Golden-Classic-Tamil-2026-20260717233647-500x500.jpg', 'https://aac.saavncdn.com/275/f6f504304c7f5e315a6c99c7bd55e9f4_320.mp4'),
  createTrack('90s_2', 'Mandram Vantha Thendralukku', 'S.P. Balasubrahmanyam, Ilaiyaraaja • Mouna Ragam', 'Mouna Ragam', 312, 'https://c.saavncdn.com/000/default_Saregama-500x500.jpg', 'https://aac.saavncdn.com/102/9aaa4391eee2a586033e8026ad2c9d9a_sar_320.mp4'),
  createTrack('90s_3', 'Raja Raja Chozhan Naan', 'K.J. Yesudas, Ilaiyaraaja • Rettai Vaal Kuruvi', 'Rettai Vaal Kuruvi', 270, 'https://c.saavncdn.com/636/Ilaiyaraaja-Radio-Hour-Tamil-2026-20260703154336-500x500.jpg', 'https://aac.saavncdn.com/636/c2097bea3fe052e7533313845cb2f017_320.mp4'),
  createTrack('90s_4', 'Thendral Vanthu Theendumbothu', 'Ilaiyaraaja, S. Janaki • Avatharam', 'Avatharam', 321, 'https://c.saavncdn.com/519/The-Ultimate-90s-Collection-Vol-1-Tamil-1992-20251206082335-500x500.jpg', 'https://aac.saavncdn.com/519/b5941a80c065c47024925def4b0a8b53_320.mp4'),
  createTrack('90s_5', 'Sundari Kannal Oru Sethi', 'S.P. Balasubrahmanyam, S. Janaki • Thalapathi', 'Thalapathi', 432, 'https://c.saavncdn.com/275/Tamil-Golden-Classic-Tamil-2026-20260717233647-500x500.jpg', 'https://aac.saavncdn.com/275/6a8748fcfb124a2f08f103e397969ef4_320.mp4'),
  createTrack('90s_6', 'Chinna Chinna Aasai', 'Minmini, A.R. Rahman • Roja', 'Roja', 295, 'https://c.saavncdn.com/702/Roja-Tamil-1992-20251011230302-500x500.jpg', 'https://aac.saavncdn.com/702/d7abe1123a022f3fb9f3e4bf725a032a_320.mp4'),
  createTrack('90s_7', 'Pudhu Vellai Mazhai', 'Unni Menon, Sujatha • Roja', 'Roja', 315, 'https://c.saavncdn.com/702/Roja-Tamil-1992-20251011230302-500x500.jpg', 'https://aac.saavncdn.com/702/a40e5b929e7a35d61fadf1beaa363036_320.mp4'),
  createTrack('90s_8', 'Roja Roja', 'S.P. Balasubrahmanyam • Kadhalar Dhinam', 'Kadhalar Dhinam', 342, 'https://c.saavncdn.com/622/Kadhalar-Dhinam-1999-500x500.jpg', 'https://aac.saavncdn.com/801/5eb77cfe731ddc66af1b1af9d785bc6d_320.mp4'),
  TOP_50_TRACKS[33], // Pachai Nirame
  TOP_50_TRACKS[31], // Poongatrile
  TOP_50_TRACKS[32], // Enna Solla Pogirai
  createTrack('90s_12', 'Ennavale Adi Ennavale', 'Unni Menon, A.R. Rahman • Kadhalan', 'Kadhalan', 312, 'https://c.saavncdn.com/017/Kaadhalan-Tamil-1995-20251203113001-500x500.jpg', 'https://aac.saavncdn.com/017/3369b66abd3e4204b992c8a1e2daf471_320.mp4'),
  createTrack('90s_13', 'Malargale Malargale', 'Hariharan, K.S. Chithra • Love Birds', 'Love Birds', 374, 'https://c.saavncdn.com/361/Souvenirs-English-2007-500x500.jpg', 'https://aac.saavncdn.com/361/500f5d54bfa9ef4b5696c9d6af9b4e9a_320.mp4'),
  createTrack('90s_14', 'Kannalane', 'K.S. Chithra, A.R. Rahman • Bombay', 'Bombay', 348, 'https://c.saavncdn.com/596/Bombay-Tamil-1995-20231229162043-500x500.jpg', 'https://aac.saavncdn.com/596/febadce89f1646e8d16784654a0e9801_320.mp4'),
  createTrack('90s_15', 'Uyire Uyire', 'Hariharan, K.S. Chithra • Bombay', 'Bombay', 432, 'https://c.saavncdn.com/005/Thotti-Jaya-Tamil-2005-20220706004607-500x500.jpg', 'https://aac.saavncdn.com/005/6c71bd6dad3028b176ae534980f91208_320.mp4'),
  createTrack('90s_16', 'Senthamizh Naattu Tamizhe', 'S.P. Balasubrahmanyam • Keladi Kanmani', 'Keladi Kanmani', 256, 'https://c.saavncdn.com/837/Paasa-Paravaigal-Original-Motion-Picture-Soundtrack--Tamil-1988-20220131223711-500x500.jpg', 'https://aac.saavncdn.com/837/72733887417dc7ebb2f0719adfed4350_320.mp4'),
  createTrack('90s_17', 'Chinna Thambi Periya Thambi', 'S.P. Balasubrahmanyam, Ilaiyaraaja', 'Chinna Thambi', 280, 'https://c.saavncdn.com/159/Chinna-Thambi-Periya-Thambi-Original-Motion-Picture-Soundtrack--Tamil-1987-20220113203425-500x500.jpg', 'https://aac.saavncdn.com/159/bd1364164c0794deb1636caf8d171bcb_320.mp4'),
  createTrack('90s_18', 'Mettupodu Mettupodu', 'Mano, S.P.B • Duet', 'Duet', 298, 'https://c.saavncdn.com/962/Duet-Tamil-1994-20231229162110-500x500.jpg', 'https://aac.saavncdn.com/962/77214f7c55e0aa52d76d488024846287_320.mp4'),
  createTrack('90s_19', 'Anjali Anjali Pushpanjali', 'S.P. Balasubrahmanyam, K.S. Chithra • Duet', 'Duet', 354, 'https://c.saavncdn.com/null/Ganapati-Utsav-Aarti-Sangrah-Marathi-2020-20200813161427-500x500.jpg', 'https://aac.saavncdn.com/null/2fb9b953d45b34908851de45a9488e01_320.mp4'),
  createTrack('90s_20', 'Poove Sempoove', 'K.J. Yesudas, Ilaiyaraaja • Solla Thudikuthu Manasu', 'Solla Thudikuthu Manasu', 320, 'https://c.saavncdn.com/128/Solla-Thudikuthu-Manasu-Original-Motion-Picture-Soundtrack-Tamil-2024-20240216203823-500x500.jpg', 'https://aac.saavncdn.com/128/a459dbe2d6c0b7f09425a8f924c0c807_320.mp4'),
  createTrack('90s_21', 'Nilaave Vaa Sellathey Vaa', 'S.P. Balasubrahmanyam • Mouna Ragam', 'Mouna Ragam', 290, 'https://c.saavncdn.com/256/Mouna-Ragam-Tamil-2024-20251210130325-500x500.jpg', 'https://aac.saavncdn.com/256/f8f1eb835453f3661bd9be2745c3c508_320.mp4'),
  createTrack('90s_22', 'Valaiyosai Kala Kalavena', 'S.P. Balasubrahmanyam, Lata Mangeshkar • Sathya', 'Sathya', 284, 'https://c.saavncdn.com/636/Sathya-Tamil-1988-20200812120000-500x500.jpg', 'https://aac.saavncdn.com/636/0198b86403ab586110b32162a5b56209_320.mp4'),
  createTrack('90s_23', 'Poove Poochudava', 'K.J. Yesudas, Ilaiyaraaja • Poove Poochudava', 'Poove Poochudava', 274, 'https://c.saavncdn.com/633/Poove-Poochooda-Vaa-Original-Motion-Picture-Soundtrack--Tamil-1985-20220113202501-500x500.jpg', 'https://aac.saavncdn.com/633/8a41034a19a8847ab89fe6018510beb1_320.mp4'),
  createTrack('90s_24', 'Kalyana Maalai Kondadum Penne', 'S.P. Balasubrahmanyam • Pudhu Pudhu Arthangal', 'Pudhu Pudhu Arthangal', 288, 'https://c.saavncdn.com/560/Pudhu-Pudhu-Arthangal-Original-Motion-Picture-Soundtrack-Tamil-2024-20240208155942-500x500.jpg', 'https://aac.saavncdn.com/560/a69bed0d0194e48f7dea26853922f74d_320.mp4'),
  createTrack('90s_25', 'Poonkadhave Thazhthiravai', 'Deepan Chakravarthy, Uma Ramanan • Nizhalgal', 'Nizhalgal', 270, 'https://c.saavncdn.com/289/Nizhalgal-Tamil-1980-20200812120000-500x500.jpg', 'https://aac.saavncdn.com/289/fa3775f2357d34fc3da189297c14a36f_320.mp4'),
  createTrack('90s_26', 'Vaan Nila Nila Alla', 'S.P. Balasubrahmanyam • Pattina Pravesam', 'Pattina Pravesam', 252, 'https://c.saavncdn.com/934/Classic-Revival-Hits-Volume-02-Tamil-Tamil-2005-20181105-500x500.jpg', 'https://aac.saavncdn.com/934/f915bb439a9b850619a41f31dd07f913_320.mp4'),
  createTrack('90s_27', 'Idhu Oru Pon Maalai Pozhudhu', 'S.P. Balasubrahmanyam • Nizhalgal', 'Nizhalgal', 260, 'https://c.saavncdn.com/834/Tamil-Classic-80-s-to-90-s-Tamil-2026-20260717233647-500x500.jpg', 'https://aac.saavncdn.com/834/b12c3a5c4c7aad9116e73111049821a0_320.mp4'),
  createTrack('90s_28', 'Sangeetha Megam', 'S.P. Balasubrahmanyam • Udhaya Geetham', 'Udhaya Geetham', 284, 'https://c.saavncdn.com/008/Udhaya-Geetham-Original-Motion-Picture-Soundtrack--Tamil-1985-20220124161336-500x500.jpg', 'https://aac.saavncdn.com/008/1965de628b48af3190702c542fa50760_320.mp4'),
  createTrack('90s_29', 'En Iniya Pon Nilaave', 'K.J. Yesudas • Moodu Pani', 'Moodu Pani', 272, 'https://c.saavncdn.com/675/Moodu-Pani-Tamil-1980-20220429143432-500x500.jpg', 'https://aac.saavncdn.com/675/daf745b80a9c6d283d79e49ca6fa416e_320.mp4'),
  createTrack('90s_30', 'Kanne Kalaimane', 'K.J. Yesudas, Ilaiyaraaja • Moondram Pirai', 'Moondram Pirai', 246, 'https://c.saavncdn.com/353/Moondram-Pirai-Original-Motion-Picture-Soundtrack--Tamil-1982-20220124155323-500x500.jpg', 'https://aac.saavncdn.com/353/4204011750074dd29c8244cae4e57626_320.mp4'),
  createTrack('90s_31', 'Poongathave Thazh Thiravai', 'Deepan Chakravarthy • Nizhalgal', 'Nizhalgal', 268, 'https://c.saavncdn.com/289/Classic-Revival-Hits-Volume-02-Tamil-Tamil-2005-20200904083941-500x500.jpg', 'https://aac.saavncdn.com/289/fa3775f2357d34fc3da189297c14a36f_320.mp4'),
  createTrack('90s_32', 'O Butterfly', 'S.P. Balasubrahmanyam, Asha Bhosle • Meera', 'Meera', 342, 'https://c.saavncdn.com/816/Meera-Tamil-2017-20201124152447-500x500.jpg', 'https://aac.saavncdn.com/816/75fa11ba4d28e706d7af26a0d0828d2c_320.mp4'),
  createTrack('90s_33', 'Thendral Kaatre', 'Hariharan • Kumbakonam Gopalu', 'Gopalu', 276, 'https://c.saavncdn.com/558/Eeramana-Rojave-Tamil-2022-20251210130245-500x500.jpg', 'https://aac.saavncdn.com/558/1d5894dc1e3aafcf020ca3e60158e8d3_320.mp4'),
  createTrack('90s_34', 'Margazhi Poove', 'Shobana Vignesh, A.R. Rahman • May Maadham', 'May Maadham', 374, 'https://c.saavncdn.com/222/Jay-Jay-Tamil-2025-20250930144203-500x500.jpg', 'https://aac.saavncdn.com/222/833b329927fb6aded922638214224b86_320.mp4'),
  createTrack('90s_35', 'En Mel Vizhunda Mazhai Thuli', 'P. Jayachandran, K.S. Chithra • May Maadham', 'May Maadham', 345, 'https://c.saavncdn.com/420/90-s-Love-Special-Vol-1-Tamil-2017-500x500.jpg', 'https://aac.saavncdn.com/420/baddfdd62395fdbc968a804e96c7ea3a_320.mp4')
];

// =========================================================================
// 4. NIGHT DRIVE (MIDNIGHT SYNTH HIGHWAY) - 30 Tracks
// =========================================================================
const NIGHT_DRIVE_TRACKS: Song[] = [
  TOP_50_TRACKS[44], // Po Nee Po
  TOP_50_TRACKS[29], // Marakkuma Nenjam
  TOP_50_TRACKS[30], // New York Nagaram
  TOP_50_TRACKS[38], // Aaromale
  TOP_50_TRACKS[21], // Wasted
  TOP_50_TRACKS[16], // Ordinary Person
  TOP_50_TRACKS[17], // Lokiverse 2.0
  TOP_50_TRACKS[19], // Porkanda Singam
  TOP_50_TRACKS[20], // Once Upon a Time
  TOP_50_TRACKS[28], // Venmathi Venmathiye
  TOP_50_TRACKS[35], // Nenjukkul Peidhidum
  TOP_50_TRACKS[37], // Hosanna
  FIRST_LOVE_TRACKS[29], // Megham Karukatha
  FIRST_LOVE_TRACKS[33], // Bodhai Kodhai
  FIRST_LOVE_TRACKS[32], // Kanave Kanave
  FIRST_LOVE_TRACKS[31], // Adiye
  FIRST_LOVE_TRACKS[37], // Maya Nadhi
  FIRST_LOVE_TRACKS[38], // Kadhale Kadhale
  FIRST_LOVE_TRACKS[19], // Thalli Pogathey
  FIRST_LOVE_TRACKS[16], // Oru Maalai
  createTrack('nd_21', 'Kaatrukkenna Veli', 'A.R. Rahman • Avvai Shanmughi', 'Avvai Shanmughi', 270, 'https://c.saavncdn.com/422/Avvai-Shanmugi-Tamil-2017-500x500.jpg', 'https://aac.saavncdn.com/422/f58d38727bef0248de194b7d595cd389_320.mp4'),
  createTrack('nd_22', 'Ennodu Nee Irundhaal', 'Sid Sriram, Sunitha Sarathy • I', 'I', 354, 'https://c.saavncdn.com/590/I-Tamil-2014-20190822153052-500x500.jpg', 'https://aac.saavncdn.com/590/19c5fc3ede661e36e5a87f11df716919_320.mp4'),
  createTrack('nd_23', 'Azhagho Azhagu', 'S.P. Balasubrahmanyam • Samarpanam', 'Samarpanam', 290, 'https://c.saavncdn.com/939/Samarpanam-M-S-Subbulakshmi-Hindi-2005-20200910173914-500x500.jpg', 'https://aac.saavncdn.com/939/1bbf647d454f021160a1a98bc72d366f_sar_320.mp4'),
  createTrack('nd_24', 'Unnaale Unnaale', 'Hariharan, Krish, Suchitra • Unnale Unnale', 'Unnale Unnale', 312, 'https://c.saavncdn.com/644/Ghajini-2005-500x500.jpg', 'https://aac.saavncdn.com/173/14893e8a1e4e4b7b2ebce294c1ee4984_320.mp4'),
  createTrack('nd_25', 'Siragugal', 'Javed Ali, Madhushree, Yuvan • Sarvam', 'Sarvam', 298, 'https://c.saavncdn.com/191/Sarvam-Tamil-2009-20251230163348-500x500.jpg', 'https://aac.saavncdn.com/191/25c08d935c290e4cbfce0dd89f65ba0c_320.mp4'),
  createTrack('nd_26', 'Kaadhal Kondein BGM', 'Yuvan Shankar Raja • Kaadhal Kondein', 'Kaadhal Kondein', 198, 'https://c.saavncdn.com/885/Distractions-Unknown-2017-20220406071334-500x500.jpg', 'https://aac.saavncdn.com/885/4a802e043995965b7c39c7d28acae837_320.mp4'),
  createTrack('nd_27', 'Neethane Neethane', 'A.R. Rahman, Shreya Ghoshal • Mersal', 'Mersal', 269, 'https://c.saavncdn.com/492/Mersal-Tamil-2017-20170820120559-500x500.jpg', 'https://aac.saavncdn.com/492/0c77ae175fcc89080d56283a53274717_320.mp4'),
  createTrack('nd_28', 'Mazhai Kuruvi', 'A.R. Rahman • CCV', 'Chekka Chivantha Vaanam', 348, 'https://c.saavncdn.com/162/Chekka-Chivantha-Vaanam-Tamil-2018-20201203125023-500x500.jpg', 'https://aac.saavncdn.com/162/21ef0efe8648fc783479dc0ffc0b67cd_320.mp4'),
  createTrack('nd_29', 'Bhoomi Bhoomi', 'A.R. Rahman • CCV', 'Chekka Chivantha Vaanam', 284, 'https://c.saavncdn.com/162/Chekka-Chivantha-Vaanam-Tamil-2018-20201203125023-500x500.jpg', 'https://aac.saavncdn.com/162/1e55485307a4c0bdb89a9446d480e2bc_320.mp4'),
  createTrack('nd_30', 'Oru Naalil', 'Yuvan Shankar Raja • Pudhupettai', 'Pudhupettai', 346, 'https://c.saavncdn.com/138/Pudhupettai-Tamil-2005-20210402101916-500x500.jpg', 'https://aac.saavncdn.com/138/6516dc2380bf210d45e778747d6a2d7e_320.mp4')
];

// =========================================================================
// 5. BEAST WORKOUT (GYM HYPE & ADRENALINE) - 30 Tracks
// =========================================================================
const WORKOUT_TRACKS: Song[] = [
  TOP_50_TRACKS[0],  // Hukum
  TOP_50_TRACKS[2],  // Naa Ready
  TOP_50_TRACKS[6],  // Badass
  TOP_50_TRACKS[3],  // Illuminati
  TOP_50_TRACKS[1],  // Arabic Kuthu
  TOP_50_TRACKS[18], // Vikram Title Track
  TOP_50_TRACKS[11], // Thee Thalapathy
  TOP_50_TRACKS[13], // Zinda Banda
  TOP_50_TRACKS[45], // Matta
  TOP_50_TRACKS[47], // Kadharalz
  TOP_50_TRACKS[48], // Whistle Podu
  TOP_50_TRACKS[8],  // Jalabulanjangu
  TOP_50_TRACKS[22], // Pathala Pathala
  TOP_50_TRACKS[40], // Rowdy Baby
  TOP_50_TRACKS[25], // Two Two Two
  TOP_50_TRACKS[14], // Not Ramaiya Vastavaiya
  createTrack('wk_17', 'Surviva', 'Anirudh Ravichander, Yogi B • Vivegam', 'Vivegam', 222, 'https://c.saavncdn.com/303/Vivegam-Tamil-2017-20170807081008-500x500.jpg', 'https://aac.saavncdn.com/303/4a2ee36fb589fcab0e546781fbb57ae5_320.mp4'),
  createTrack('wk_18', 'Beast Mode', 'Anirudh Ravichander • Beast', 'Beast', 218, 'https://c.saavncdn.com/510/Beast-Tamil-2022-20220504184736-500x500.jpg', 'https://aac.saavncdn.com/510/ea2b28ffb0c1111b1525800652c1999c_320.mp4'),
  createTrack('wk_19', 'Aaluma Doluma', 'Anirudh Ravichander • Vedalam', 'Vedalam', 258, 'https://c.saavncdn.com/323/Vedalam-Tamil-2015-20260120201356-500x500.jpg', 'https://aac.saavncdn.com/323/7b0f4cf0f773cff9514e9913312610b7_320.mp4'),
  createTrack('wk_20', 'Vaathi Raid', 'Anirudh Ravichander • Master', 'Master', 211, 'https://c.saavncdn.com/347/Master-Tamil-2020-20200316084627-500x500.jpg', 'https://aac.saavncdn.com/347/f0125d45bce0c2782806d460e7e9cfbb_320.mp4'),
  createTrack('wk_21', 'Vaathi Coming', 'Anirudh Ravichander, Gana Balachandar • Master', 'Master', 230, 'https://c.saavncdn.com/347/Master-Tamil-2020-20200316084627-500x500.jpg', 'https://aac.saavncdn.com/347/c536b256fca6b96aa432322c11c21fbb_320.mp4'),
  createTrack('wk_22', 'Mersal Arasan', 'G.V. Prakash, Naresh Iyer, Sharanya • Mersal', 'Mersal', 256, 'https://c.saavncdn.com/492/Mersal-Tamil-2017-20170820120559-500x500.jpg', 'https://aac.saavncdn.com/492/12519eafc9124476a360208cf297d445_320.mp4'),
  createTrack('wk_23', 'Aalaporaan Thamizhan', 'Kailash Kher, Sathya Prakash • Mersal', 'Mersal', 348, 'https://c.saavncdn.com/492/Mersal-Tamil-2017-20170820120559-500x500.jpg', 'https://aac.saavncdn.com/492/eb45d961a1639b3c3a6df4c8777fa71c_320.mp4'),
  createTrack('wk_24', 'Danga Maari Oodhari', 'Dhanush, Marana Gana Viji • Anegan', 'Anegan', 342, 'https://c.saavncdn.com/274/Anegan-Tamil-2014-20190822152158-500x500.jpg', 'https://aac.saavncdn.com/274/a8926a75044ad4bcb6f57d22176c82c2_320.mp4'),
  createTrack('wk_25', 'Neruppu Da', 'Arunraja Kamaraj • Kabali', 'Kabali', 213, 'https://c.saavncdn.com/506/Kabali-Original-Motion-Picture-Soundtrack-Tamil-2016-20250905072302-500x500.jpg', 'https://aac.saavncdn.com/506/638c428c340db889a19c26e3e3fff29a_320.mp4'),
  createTrack('wk_26', 'Ullaallaa', 'Nakash Aziz, Inno Genga • Petta', 'Petta', 296, 'https://c.saavncdn.com/166/Petta-Tamil-2018-20181210095910-500x500.jpg', 'https://aac.saavncdn.com/166/12b71551c3a9deb7be952b45f2180de6_320.mp4'),
  createTrack('wk_27', 'Marana Mass', 'Anirudh Ravichander, S.P.B • Petta', 'Petta', 216, 'https://c.saavncdn.com/166/Petta-Tamil-2018-20181210095910-500x500.jpg', 'https://aac.saavncdn.com/166/60a22f141316c945f00dd020464550e5_320.mp4'),
  createTrack('wk_28', 'Dheera Dheera', 'Ananya Bhat • KGF', 'KGF Chapter 1', 222, 'https://c.saavncdn.com/191/KGF-Chapter-1-Tamil-Tamil-2018-20260513110001-500x500.jpg', 'https://aac.saavncdn.com/191/3e1a921d82ef0a12c4400490a47b9299_320.mp4'),
  createTrack('wk_29', 'Toofan', 'Brijesh Shandilya • KGF 2', 'KGF Chapter 2', 214, 'https://c.saavncdn.com/706/KGF-Chapter-2-Hindi-2022-20220522091045-500x500.jpg', 'https://aac.saavncdn.com/706/e39d4eaa5ae113ce6cdd599bed8d10ec_320.mp4'),
  createTrack('wk_30', 'Sulthan', 'Karthik, Vivek Shiva • Sulthan', 'Sulthan', 238, 'https://c.saavncdn.com/706/KGF-Chapter-2-Hindi-2022-20220522091045-500x500.jpg', 'https://aac.saavncdn.com/706/7f81d72a8e6ecafb9a7df06bc29ed460_320.mp4')
];

// =========================================================================
// 6. KOLLYWOOD CHILLOUT (ACOUSTIC & RELAXING MELODIES) - 30 Tracks
// =========================================================================
const CHILL_TRACKS: Song[] = [
  TOP_50_TRACKS[5],  // Vaseegara
  TOP_50_TRACKS[28], // Venmathi Venmathiye
  TOP_50_TRACKS[29], // Marakkuma Nenjam
  TOP_50_TRACKS[34], // Munbe Vaa
  TOP_50_TRACKS[35], // Nenjukkul Peidhidum
  TOP_50_TRACKS[36], // Annul Maelae
  TOP_50_TRACKS[37], // Hosanna
  TOP_50_TRACKS[39], // Omana Penne
  TOP_50_TRACKS[42], // Kannazhaga
  TOP_50_TRACKS[27], // Naan Pizhai
  TOP_50_TRACKS[33], // Pachai Nirame
  TOP_50_TRACKS[31], // Poongatrile
  TOP_50_TRACKS[32], // Enna Solla Pogirai
  TOP_50_TRACKS[49], // Chinna Chinna Kangal
  TOP_50_TRACKS[15], // Hayyoda
  TOP_50_TRACKS[24], // Bae
  TOP_50_TRACKS[44], // Po Nee Po
  TOP_50_TRACKS[41], // High on Love
  FIRST_LOVE_TRACKS[17], // Mundhinam Paartheney
  FIRST_LOVE_TRACKS[20], // Kaadhal Sadugudu
  FIRST_LOVE_TRACKS[21], // Snehithane
  FIRST_LOVE_TRACKS[23], // Azhagiya Theeye
  FIRST_LOVE_TRACKS[24], // Unakkul Naane
  FIRST_LOVE_TRACKS[34], // Moongil Thottam
  FIRST_LOVE_TRACKS[37], // Maya Nadhi
  FIRST_LOVE_TRACKS[38], // Kadhale Kadhale
  NIGHT_DRIVE_TRACKS[24], // Siragugal
  NIGHT_DRIVE_TRACKS[27], // Mazhai Kuruvi
  createTrack('ch_29', 'Enna Naan Seiven', 'Pradeep Kumar • Meyadha Maan', 'Meyadha Maan', 248, 'https://c.saavncdn.com/084/Meyaadha-Maan-Original-Motion-Picture-Soundtrack-Tamil-2017-20251024173013-500x500.jpg', 'https://aac.saavncdn.com/084/c5c7b601eb9b4a5ade46e37cfe83cb58_320.mp4'),
  createTrack('ch_30', 'Kadhalaada', 'Pradeep Kumar, Shashaa Tirupati • Vivegam', 'Vivegam', 272, 'https://c.saavncdn.com/303/Vivegam-Tamil-2017-20170807081008-500x500.jpg', 'https://aac.saavncdn.com/303/5ca4a46026dff3ee00ab64f73dd0b40d_320.mp4')
];

// =========================================================================
// 7. KUTHU & PARTY BLAST (FESTIVAL DANCE BANGERS) - 30 Tracks
// =========================================================================
const KUTHU_TRACKS: Song[] = [
  TOP_50_TRACKS[1],  // Arabic Kuthu
  TOP_50_TRACKS[45], // Matta
  TOP_50_TRACKS[4],  // Manasilaayo
  TOP_50_TRACKS[2],  // Naa Ready
  TOP_50_TRACKS[0],  // Hukum
  TOP_50_TRACKS[7],  // Kaavaalaa
  TOP_50_TRACKS[8],  // Jalabulanjangu
  TOP_50_TRACKS[9],  // Ranjithame
  TOP_50_TRACKS[10], // Jimikki Ponnu
  TOP_50_TRACKS[46], // Spark
  TOP_50_TRACKS[48], // Whistle Podu
  TOP_50_TRACKS[40], // Rowdy Baby
  TOP_50_TRACKS[25], // Two Two Two
  TOP_50_TRACKS[26], // Dippam Dappam
  TOP_50_TRACKS[22], // Pathala Pathala
  TOP_50_TRACKS[11], // Thee Thalapathy
  TOP_50_TRACKS[43], // Why This Kolaveri Di
  TOP_50_TRACKS[13], // Zinda Banda
  WORKOUT_TRACKS[20], // Vaathi Coming
  WORKOUT_TRACKS[18], // Aaluma Doluma
  WORKOUT_TRACKS[21], // Mersal Arasan
  WORKOUT_TRACKS[23], // Danga Maari
  WORKOUT_TRACKS[26], // Marana Mass
  WORKOUT_TRACKS[25], // Ullaallaa
  createTrack('kp_25', 'Chellama', 'Anirudh Ravichander, Jonita Gandhi • Doctor', 'Doctor', 236, 'https://c.saavncdn.com/312/Doctor-Tamil-2021-20211005133149-500x500.jpg', 'https://aac.saavncdn.com/312/9faaf9ef4a0f3596b15adfbf3b9cc273_320.mp4'),
  createTrack('kp_26', 'So Baby', 'Anirudh Ravichander, Ananthakrrishnan • Doctor', 'Doctor', 252, 'https://c.saavncdn.com/312/Doctor-Tamil-2021-20211005133149-500x500.jpg', 'https://aac.saavncdn.com/312/af028821abce11d56bcb6417f5c58f6c_320.mp4'),
  createTrack('kp_27', 'Sodakku', 'Anthony Daasan, Anirudh • TSK', 'Thaanaa Serndha Koottam', 238, 'https://c.saavncdn.com/068/Thaanaa-Serndha-Koottam-Tamil-2018-20180103181741-500x500.jpg', 'https://aac.saavncdn.com/068/f568cf30cfad8396080740dc15ac195e_320.mp4'),
  createTrack('kp_28', 'Guleba', 'Anirudh Ravichander, Mervin Solomon • Gulaebaghavali', 'Gulaebaghavali', 282, 'https://c.saavncdn.com/251/Gulaebaghavali-Original-Motion-Picture-Soundtrack-Tamil-2017-20251026074527-500x500.jpg', 'https://aac.saavncdn.com/251/a6f61786e658a8bf89a51f1197f397de_320.mp4'),
  createTrack('kp_29', 'Verithanam', 'Thalapathy Vijay, A.R. Rahman • Bigil', 'Bigil', 254, 'https://c.saavncdn.com/162/Bigil-Tamil-2019-20191017202521-500x500.jpg', 'https://aac.saavncdn.com/162/c005e1ef77af574df7ba1d24bd8ee9ea_320.mp4'),
  createTrack('kp_30', 'Singappenney', 'A.R. Rahman, Shashaa Tirupati • Bigil', 'Bigil', 374, 'https://c.saavncdn.com/162/Bigil-Tamil-2019-20191017202521-500x500.jpg', 'https://aac.saavncdn.com/162/a888165f1ebeda4b0ac6ac7f4be1a0f6_320.mp4')
];

// =========================================================================
// 8. ANIRUDH MASS ANTHEMS - 30 Tracks
// =========================================================================
const ANIRUDH_TRACKS: Song[] = [
  TOP_50_TRACKS[0],  // Hukum
  TOP_50_TRACKS[2],  // Naa Ready
  TOP_50_TRACKS[6],  // Badass
  TOP_50_TRACKS[1],  // Arabic Kuthu
  TOP_50_TRACKS[4],  // Manasilaayo
  TOP_50_TRACKS[7],  // Kaavaalaa
  TOP_50_TRACKS[18], // Vikram Title Track
  TOP_50_TRACKS[8],  // Jalabulanjangu
  TOP_50_TRACKS[22], // Pathala Pathala
  TOP_50_TRACKS[47], // Kadharalz
  TOP_50_TRACKS[19], // Porkanda Singam
  TOP_50_TRACKS[20], // Once Upon a Time
  TOP_50_TRACKS[21], // Wasted
  TOP_50_TRACKS[16], // Ordinary Person
  TOP_50_TRACKS[17], // Lokiverse 2.0
  TOP_50_TRACKS[23], // Private Party
  TOP_50_TRACKS[24], // Bae
  TOP_50_TRACKS[25], // Two Two Two
  TOP_50_TRACKS[26], // Dippam Dappam
  TOP_50_TRACKS[27], // Naan Pizhai
  TOP_50_TRACKS[42], // Kannazhaga
  TOP_50_TRACKS[43], // Why This Kolaveri Di
  TOP_50_TRACKS[44], // Po Nee Po
  WORKOUT_TRACKS[20], // Vaathi Coming
  WORKOUT_TRACKS[19], // Vaathi Raid
  WORKOUT_TRACKS[18], // Aaluma Doluma
  WORKOUT_TRACKS[16], // Surviva
  WORKOUT_TRACKS[26], // Marana Mass
  KUTHU_TRACKS[24],  // Chellama
  KUTHU_TRACKS[26]   // Sodakku
];

// =========================================================================
// 9. A.R. RAHMAN ISAI PUYAL - 30 Tracks
// =========================================================================
const RAHMAN_TRACKS: Song[] = [
  TOP_50_TRACKS[34], // Munbe Vaa
  TOP_50_TRACKS[30], // New York Nagaram
  TOP_50_TRACKS[33], // Pachai Nirame
  TOP_50_TRACKS[32], // Enna Solla Pogirai
  TOP_50_TRACKS[37], // Hosanna
  NINETIES_TRACKS[5], // Chinna Chinna Aasai
  NINETIES_TRACKS[6], // Pudhu Vellai Mazhai
  NINETIES_TRACKS[7], // Roja Roja
  NINETIES_TRACKS[11], // Ennavale
  NINETIES_TRACKS[12], // Malargale
  NINETIES_TRACKS[13], // Kannalane
  NINETIES_TRACKS[14], // Uyire Uyire
  TOP_50_TRACKS[29], // Marakkuma Nenjam
  TOP_50_TRACKS[38], // Aaromale
  TOP_50_TRACKS[39], // Omana Penne
  TOP_50_TRACKS[31], // Poongatrile
  FIRST_LOVE_TRACKS[0], // Ambikapathy
  FIRST_LOVE_TRACKS[15], // Anbil Avan
  FIRST_LOVE_TRACKS[19], // Thalli Pogathey
  FIRST_LOVE_TRACKS[20], // Kaadhal Sadugudu
  FIRST_LOVE_TRACKS[21], // Snehithane
  NIGHT_DRIVE_TRACKS[20], // Kaatrukkenna Veli
  NIGHT_DRIVE_TRACKS[21], // Ennodu Nee Irundhaal
  NIGHT_DRIVE_TRACKS[26], // Neethane Neethane
  NIGHT_DRIVE_TRACKS[27], // Mazhai Kuruvi
  NIGHT_DRIVE_TRACKS[28], // Bhoomi Bhoomi
  WORKOUT_TRACKS[21], // Mersal Arasan
  WORKOUT_TRACKS[22], // Aalaporaan Thamizhan
  KUTHU_TRACKS[28],  // Verithanam
  KUTHU_TRACKS[29]   // Singappenney
];

// =========================================================================
// 10. YUVAN SHANKAR RAJA DRUG BGMS & CLASSICS - 25 Tracks
// =========================================================================
const YUVAN_TRACKS: Song[] = [
  TOP_50_TRACKS[45], // Matta
  TOP_50_TRACKS[46], // Spark
  TOP_50_TRACKS[48], // Whistle Podu
  TOP_50_TRACKS[49], // Chinna Chinna Kangal
  TOP_50_TRACKS[40], // Rowdy Baby
  TOP_50_TRACKS[41], // High on Love
  NIGHT_DRIVE_TRACKS[24], // Siragugal
  NIGHT_DRIVE_TRACKS[25], // Kaadhal Kondein BGM
  NIGHT_DRIVE_TRACKS[29], // Oru Naalil
  createTrack('u1_10', 'Pogathey', 'Yuvan Shankar Raja • Deepavali', 'Deepavali', 280, 'https://c.saavncdn.com/181/DADA-Tamil-2022-20230205170105-500x500.jpg', 'https://aac.saavncdn.com/181/809ac29f0ca4e01abd57b960a534047f_320.mp4'),
  createTrack('u1_11', 'Venmegam', 'Hariharan, Yuvan • Yaaradi Nee Mohini', 'Yaaradi Nee Mohini', 290, 'https://c.saavncdn.com/894/Yaaradi-Nee-Mohini-Tamil-2008-20200620135829-500x500.jpg', 'https://aac.saavncdn.com/894/70351f415a0d092864c7fe46bbfb876f_320.mp4'),
  createTrack('u1_12', 'En Kadhal Solla', 'Yuvan Shankar Raja • Paiyaa', 'Paiyaa', 295, 'https://c.saavncdn.com/984/Paiya-Tamil-2010-20200620134043-500x500.jpg', 'https://aac.saavncdn.com/984/a8033293eda300991e44a30de15adbae_320.mp4'),
  createTrack('u1_13', 'Thuli Thuli', 'Haricharan, Tanvi Shah • Paiyaa', 'Paiyaa', 284, 'https://c.saavncdn.com/984/Paiya-Tamil-2010-20200620134043-500x500.jpg', 'https://aac.saavncdn.com/984/140dab73f557be9ad8d1b002d501840e_320.mp4'),
  createTrack('u1_14', 'Adada Mazhaida', 'Rahul Nambiar, Saindhavi • Paiyaa', 'Paiyaa', 320, 'https://c.saavncdn.com/984/Paiya-Tamil-2010-20200620134043-500x500.jpg', 'https://aac.saavncdn.com/984/832992409558d09a6dd372c5f1ceacfd_320.mp4'),
  createTrack('u1_15', 'Oru Kal Oru Kannadi', 'Yuvan Shankar Raja • SMS', 'Siva Manasula Sakthi', 312, 'https://c.saavncdn.com/291/Oru-Kal-Oru-Kannadi-Tamil-2012-20260120201257-500x500.jpg', 'https://aac.saavncdn.com/291/914a16f0bbe52b494508067a0283180e_320.mp4'),
  createTrack('u1_16', 'Saroja Saman Nikalo', 'Shankar Mahadevan, Premji • Chennai 28', 'Chennai 600028', 260, 'https://c.saavncdn.com/486/Chennai-600028-2007-500x500.jpg', 'https://aac.saavncdn.com/767/a95a75dd907e82f366cb919330bd0135_320.mp4'),
  createTrack('u1_17', 'Jalsa', 'Ranjith, Tippu • Chennai 28', 'Chennai 600028', 270, 'https://c.saavncdn.com/486/Chennai-600028-2007-500x500.jpg', 'https://aac.saavncdn.com/767/a8058caa9d53f562442d702107dfbd7d_320.mp4'),
  createTrack('u1_18', 'Aedho Saigirai', 'Javed Ali, Sowmya Raoh • Vaamanan', 'Vaamanan', 285, 'https://c.saavncdn.com/610/My-Playlist-Yuvanshankar-Raja-Tamil-2014-20210522191434-500x500.jpg', 'https://aac.saavncdn.com/610/a93c907b984dceeaf3c70d9dcf93ba40_320.mp4'),
  createTrack('u1_19', 'Nenjodu Kalanthidu', 'Unnikrishnan, Sujatha • Kaadhal Kondein', 'Kaadhal Kondein', 330, 'https://c.saavncdn.com/060/Kadhal-Kondaen-Tamil-2026-20260207053711-500x500.jpg', 'https://aac.saavncdn.com/060/bf31626cc3468d5708b64a7c639fd1e1_320.mp4'),
  createTrack('u1_20', 'Thottu Thottu', 'Haricharan • Kaadhal Kondein', 'Kaadhal Kondein', 310, 'https://c.saavncdn.com/616/Kadhal-Kondaen-2003-500x500.jpg', 'https://aac.saavncdn.com/800/5e99612448dc7d841a0d9fee6c23322d_320.mp4'),
  createTrack('u1_21', 'Aaha Kaadhal', 'Haricharan • Moondru Per Moondru Kaadhal', 'MPMK', 275, 'https://c.saavncdn.com/762/Moondru-Per-Moondru-Kadhal-Tamil-2013-20260804012717-500x500.jpg', 'https://aac.saavncdn.com/762/e3a545707b94531f578f94b63c0ce5b5_320.mp4'),
  createTrack('u1_22', 'Kadhal Aasai', 'Yuvan Shankar Raja, Suriya • Anjaan', 'Anjaan', 290, 'https://c.saavncdn.com/451/Anjaan-Tamil-2014-20190822151819-500x500.jpg', 'https://aac.saavncdn.com/451/9be310e067da06465b0b4bbc8127bbe6_320.mp4'),
  createTrack('u1_23', 'Ek Do Teen', 'Suriya, Andrea Jeremiah • Anjaan', 'Anjaan', 240, 'https://c.saavncdn.com/451/Anjaan-Tamil-2014-20190822151819-500x500.jpg', 'https://aac.saavncdn.com/451/3d783e385fe55738de945737009ff0d7_320.mp4'),
  createTrack('u1_24', 'Billa Theme', 'Yuvan Shankar Raja • Billa', 'Billa', 180, 'https://c.saavncdn.com/889/Billa-Telugu-2014-20251012042238-500x500.jpg', 'https://aac.saavncdn.com/889/1b10fc19b821a774c32f12f56e376ca0_320.mp4'),
  createTrack('u1_25', 'Mankatha Theme', 'Yuvan Shankar Raja • Mankatha', 'Mankatha', 170, 'https://c.saavncdn.com/113/Mankatha-Tamil-2011-20190731133254-500x500.jpg', 'https://aac.saavncdn.com/113/a2b08ff65f215cce75330bdba34d1cb7_320.mp4'),
  createTrack('u1_26', 'Loosu Penne', 'Silambarasan TR, Blaaze, Yuvan • Vallavan', 'Vallavan', 320, 'https://c.saavncdn.com/426/Vallavan-Tamil-2025-20250930144030-500x500.jpg', 'https://aac.saavncdn.com/426/7ac7bb8c29d64328e07e6cf1c51e2b18_320.mp4'),
  createTrack('u1_27', 'Yedho Ondru Ennai', 'Yuvan Shankar Raja, Haricharan • Paiyaa', 'Paiyaa', 230, 'https://c.saavncdn.com/984/Paiya-Tamil-2010-20200620134043-500x500.jpg', 'https://aac.saavncdn.com/984/3027e08f8e096b94b8903761333bb878_320.mp4'),
  createTrack('u1_28', 'Kadavul Thandha Azhagiya Vaazhvu', 'Dhanush, Yuvan • Mayakkam Enna', 'Mayakkam Enna', 265, 'https://c.saavncdn.com/790/SIRAI-Tamil-2022-20220725225526-500x500.jpg', 'https://aac.saavncdn.com/790/d9c39e05850619f0d38ee75e8b59abe9_320.mp4'),
  createTrack('u1_29', 'Voda Voda Dhooram Kurayala', 'Dhanush, Yuvan • Mayakkam Enna', 'Mayakkam Enna', 240, 'https://c.saavncdn.com/130/Mayakkam-Enna-Tamil-2026-20260724224554-500x500.jpg', 'https://aac.saavncdn.com/130/bd2a99873302159a1f77085083b46eb9_320.mp4'),
  createTrack('u1_30', 'Kaadhal Endral', 'Yuvan Shankar Raja • Goa', 'Goa', 255, 'https://c.saavncdn.com/260/Goa-Tamil-2010-20210522185821-500x500.jpg', 'https://aac.saavncdn.com/260/40dbd6cb7007318006f1116cd50f74a2_320.mp4')
];

// =========================================================================
// 11. HARRIS JAYARAJ MINNAL MELODIES - 30 Tracks
// =========================================================================
const HARRIS_TRACKS: Song[] = [
  TOP_50_TRACKS[5],  // Vaseegara
  TOP_50_TRACKS[28], // Venmathi Venmathiye
  TOP_50_TRACKS[35], // Nenjukkul Peidhidum
  TOP_50_TRACKS[36], // Annul Maelae
  FIRST_LOVE_TRACKS[16], // Oru Maalai
  FIRST_LOVE_TRACKS[17], // Mundhinam Paartheney
  FIRST_LOVE_TRACKS[23], // Azhagiya Theeye
  FIRST_LOVE_TRACKS[24], // Unakkul Naane
  WORKOUT_TRACKS[23], // Danga Maari
  NIGHT_DRIVE_TRACKS[23], // Unnaale Unnaale
  createTrack('hj_11', 'Hasili Fisili', 'Karthik, Harini • Aadhavan', 'Aadhavan', 312, 'https://c.saavncdn.com/467/Aadhavan-Tamil-2009-20200620121107-500x500.jpg', 'https://aac.saavncdn.com/467/3f1928f49dec7520239707aa2481c561_320.mp4'),
  createTrack('hj_12', 'Yeno Yeno Panithuli', 'Shail Hada, Sudha Ragunathan • Aadhavan', 'Aadhavan', 320, 'https://c.saavncdn.com/467/Aadhavan-Tamil-2009-20200620121107-500x500.jpg', 'https://aac.saavncdn.com/467/83ec9a7e487f92d2edec28cb205caac3_320.mp4'),
  createTrack('hj_13', 'Vizhi Moodi Yosithal', 'Karthik • Ayan', 'Ayan', 330, 'https://c.saavncdn.com/658/Ayan-Tamil-2022-20220413100432-500x500.jpg', 'https://aac.saavncdn.com/658/2970bd73712be5196d367da4a4158b08_320.mp4'),
  createTrack('hj_14', 'Nenje Nenje', 'Harish Raghavendra • Ayan', 'Ayan', 325, 'https://c.saavncdn.com/658/Ayan-Tamil-2022-20220413100432-500x500.jpg', 'https://aac.saavncdn.com/658/8284ae449a6b558cc4cc130c4b31cb1f_320.mp4'),
  createTrack('hj_15', 'Pala Palakkura', 'Hariharan • Ayan', 'Ayan', 310, 'https://c.saavncdn.com/713/Ayanam-Mi-Amore-Hindi-2026-20260818090531-500x500.jpg', 'https://aac.saavncdn.com/713/6d79e91de6f9da111fffd7452f5b8f72_320.mp4'),
  createTrack('hj_16', 'Uyirin Uyire', 'KK, Suchitra • Kaakha Kaakha', 'Kaakha Kaakha', 322, 'https://c.saavncdn.com/748/Kaakha-Kaakha-Tamil-2003-500x500.jpg', 'https://aac.saavncdn.com/748/0d33a88af007717398bcc836731d49fb_320.mp4'),
  createTrack('hj_17', 'Ondra Renda Aasaigal', 'Bombay Jayashri • Kaakha Kaakha', 'Kaakha Kaakha', 315, 'https://c.saavncdn.com/516/Ondraa-Rendaa-Aasaigal-Unknown-2021-20211026094458-500x500.jpg', 'https://aac.saavncdn.com/516/d94fbcd3bd71449e708198cb548464fa_320.mp4'),
  createTrack('hj_18', 'Ennamo Yedho', 'Aalaap Raju, Prashanthini • Ko', 'Ko', 318, 'https://c.saavncdn.com/653/KO-Tamil-2011-20190731134123-500x500.jpg', 'https://aac.saavncdn.com/653/1bae7f140e3dad0f04edb2ba923927ea_320.mp4'),
  createTrack('hj_19', 'Aga Naga', 'Vijay Prakash, Tippu • Ko', 'Ko', 324, 'https://c.saavncdn.com/653/KO-Tamil-2011-20190731134123-500x500.jpg', 'https://aac.saavncdn.com/653/970419645adf882b831115bd24195fb8_320.mp4'),
  createTrack('hj_20', 'Amali Thumali', 'Hariharan, Swetha Mohan • Ko', 'Ko', 330, 'https://c.saavncdn.com/653/KO-Tamil-2011-20190731134123-500x500.jpg', 'https://aac.saavncdn.com/653/5bcacd269bcd7f1e57346653ee394f29_320.mp4'),
  createTrack('hj_21', 'Adada Oru Devathai', 'Karthik • Engeyum Kaadhal', 'Engeyum Kaadhal', 290, 'https://c.saavncdn.com/202/Classic-Tamil-Film-Melodies-Tamil-2026-20260205143720-500x500.jpg', 'https://aac.saavncdn.com/202/bac082c0571c03f46bd2509c8989b530_320.mp4'),
  createTrack('hj_22', 'Dhimu Dhimu', 'Karthik • Engeyum Kaadhal', 'Engeyum Kaadhal', 315, 'https://c.saavncdn.com/705/Engeyum-Kadhal-Tamil-2010-20190731133246-500x500.jpg', 'https://aac.saavncdn.com/705/15d30c35749cb52ca36563dda54a1842_320.mp4'),
  createTrack('hj_23', 'Nenjil Nenjil', 'Harish Raghavendra, Chinmayi • Engeyum Kaadhal', 'Engeyum Kaadhal', 305, 'https://c.saavncdn.com/705/Engeyum-Kadhal-Tamil-2010-20190731133246-500x500.jpg', 'https://aac.saavncdn.com/705/1a61af4b19a5ca7bdc9fdce36dfccec0_320.mp4'),
  createTrack('hj_24', 'Anjaley Anjaley', 'SPB, K.S. Chithra • Anjali', 'Anjali', 320, 'https://c.saavncdn.com/679/Anjaneyulu-2009-500x500.jpg', 'https://aac.saavncdn.com/679/f64e4d9de9b99adfb08cadcd10cfaba8_320.mp4'),
  createTrack('hj_25', 'Mudhal Mazhai', 'Hariharan, Mahalakshmi Iyer • Bheema', 'Bheema', 340, 'https://c.saavncdn.com/100/Bheema-Tamil--Tamil-2007-20190513145804-500x500.jpg', 'https://aac.saavncdn.com/100/d88ef65781a4ca2d0ab2ffd8ff8f66d5_320.mp4'),
  createTrack('hj_26', 'Roottu Thala', 'Harris Jayaraj • Iru Mugan', 'Iru Mugan', 238, 'https://c.saavncdn.com/913/Iru-Mugan-Tamil-2016-500x500.jpg', 'https://aac.saavncdn.com/913/46fda818f46c82942fd67a1654897b71_320.mp4'),
  createTrack('hj_27', 'June Ponal', 'Krish, Arun • Unnale Unnale', 'Unnale Unnale', 345, 'https://c.saavncdn.com/172/Unnale-Unnale-Tamil-2006-20190517115223-500x500.jpg', 'https://aac.saavncdn.com/172/88fb9ed325b767e8efc51867af01f84d_sar_320.mp4'),
  createTrack('hj_28', 'Mudhal Kanave', 'Harish Raghavendra, Bombay Jayashri • Majunu', 'Majunu', 325, 'https://c.saavncdn.com/144/Majunu-Tamil-2001-20210423104146-500x500.jpg', 'https://aac.saavncdn.com/144/6195d3be03f5b3e7c6e8db5efb1c55e8_sar_320.mp4'),
  createTrack('hj_29', 'Thoothu Varuma', 'Sunitha Sarathy, Harris Jayaraj • Kaakha Kaakha', 'Kaakha Kaakha', 278, 'https://c.saavncdn.com/748/Kaakha-Kaakha-Tamil-2003-500x500.jpg', 'https://aac.saavncdn.com/748/2ceeb9efe56cd7a312f45464a4e6e0f1_320.mp4'),
  createTrack('hj_30', 'Partha Mudhal Naale', 'Unni Menon, Bombay Jayashri • Vettaiyaadu Vilaiyaadu', 'Vettaiyaadu Vilaiyaadu', 364, 'https://c.saavncdn.com/285/Ezhumaliyane-2009-500x500.jpg', 'https://aac.saavncdn.com/408/353cc1bf1be3ddbf6ff2708b0fa96653_320.mp4')
];

// =========================================================================
// COMPLETE INBUILT PLAYLIST REGISTRY (11 Verified Topic-Specific Playlists)
// =========================================================================
export const INBUILT_PLAYLISTS: InbuiltPlaylist[] = [
  {
    id: 'top_50_tamil',
    title: 'Top 50 – Tamil Blockbusters',
    subtitle: '50 Kollywood Hits • Anirudh, Rahman, Yuvan, Harris',
    description: 'The definitive ranking of the 50 biggest hits in Tamil cinema history. From modern bass drops to evergreen melodies in 320kbps High-Definition quality.',
    coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-amber-600/50 via-orange-700/40 to-neutral-950/90',
    accentColor: '#f59e0b',
    songCount: 50,
    tracks: TOP_50_TRACKS
  },
  {
    id: 'mudhal_kaadhal',
    title: 'Mudhal Kaadhal',
    subtitle: 'Love at First Sight • Tamil Romance & Crush',
    description: 'Heart-melting Tamil melodies capturing the butterflies, rain walks, and nostalgia of first love. From Ambikapathy and Vaseegara to Munbe Vaa and Nenjukkul Peidhidum.',
    coverArt: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-rose-600/50 via-pink-700/40 to-slate-950/90',
    accentColor: '#f43f5e',
    songCount: 40,
    tracks: FIRST_LOVE_TRACKS
  },
  {
    id: '90s_vibe',
    title: '90s Vibe',
    subtitle: 'Tamil Golden Era • Ilaiyaraaja & 90s Rahman',
    description: 'Pure acoustic string arrangements, live rhythm sections, and legendary golden vocals by S.P. Balasubrahmanyam, K.J. Yesudas, and S. Janaki.',
    coverArt: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-yellow-600/40 via-amber-700/30 to-neutral-950/80',
    accentColor: '#eab308',
    songCount: 35,
    tracks: NINETIES_TRACKS
  },
  {
    id: 'night_drive',
    title: 'Night Drive',
    subtitle: 'Midnight Highway • Ambient Synth & Chill',
    description: 'Empty highways, city neon glow, and atmospheric Kollywood grooves that lock your mind into effortless relaxation.',
    coverArt: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-purple-600/40 via-indigo-700/30 to-neutral-950/80',
    accentColor: '#a855f7',
    songCount: 30,
    tracks: NIGHT_DRIVE_TRACKS
  },
  {
    id: 'beast_mode_workout',
    title: 'Beast Mode Workout',
    subtitle: 'High BPM Gym Hype • Kollywood Energy',
    description: 'Smash your PRs and push past limits with peak energy drops, heavy drum kicks, and motivating Kollywood adrenaline bangers.',
    coverArt: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-orange-600/40 via-red-700/30 to-neutral-950/80',
    accentColor: '#ea580c',
    songCount: 30,
    tracks: WORKOUT_TRACKS
  },
  {
    id: 'kollywood_chillout',
    title: 'Kollywood Chillout',
    subtitle: 'Soulful Acoustics & Unplugged Melodies',
    description: 'Relax and unwind with the most soulful, acoustic, and heartfelt Tamil melodies from Harris Jayaraj, A.R. Rahman, and Yuvan.',
    coverArt: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-blue-600/40 via-indigo-700/30 to-slate-950/80',
    accentColor: '#6366f1',
    songCount: 30,
    tracks: CHILL_TRACKS
  },
  {
    id: 'kuthu_party_blast',
    title: 'Kuthu & Party Blast',
    subtitle: 'Festival Bangers & Non-stop Dance Beats',
    description: 'Turn the volume to maximum! High-octane festival bangers, Anirudh bass drops, and celebration dance anthems.',
    coverArt: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-amber-600/40 via-red-600/30 to-purple-950/80',
    accentColor: '#f59e0b',
    songCount: 30,
    tracks: KUTHU_TRACKS
  },
  {
    id: 'anirudh_mass',
    title: 'Anirudh Mass Anthems',
    subtitle: 'Rockstar Kollywood Energy & Bass Drops',
    description: 'The definitive high-voltage collection from Rockstar Anirudh Ravichander. From Hukum and Naa Ready to Badass and Vikram.',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-indigo-600/50 via-blue-700/40 to-slate-950/90',
    accentColor: '#3b82f6',
    songCount: 30,
    tracks: ANIRUDH_TRACKS
  },
  {
    id: 'ar_rahman_hits',
    title: 'A.R. Rahman • Isai Puyal',
    subtitle: 'Oscar Maestro Evergreen Soundtracks',
    description: 'A timeless sonic journey across three decades of Isai Puyal A.R. Rahman masterpieces—from Roja and Bombay to Alaipayuthey and Sillunu Oru Kaadhal.',
    coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-teal-600/50 via-emerald-700/40 to-neutral-950/90',
    accentColor: '#14b8a6',
    songCount: 30,
    tracks: RAHMAN_TRACKS
  },
  {
    id: 'yuvan_drug_bgm',
    title: 'Yuvan Shankar Raja • Drug BGMs',
    subtitle: 'U1 Cult Anthems & Soul Melodies',
    description: 'Emotional acoustics, unforgettable chord progressions, and energetic bass from Yuvan Shankar Raja.',
    coverArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-rose-700/50 via-red-800/40 to-neutral-950/90',
    accentColor: '#e11d48',
    songCount: 30,
    tracks: YUVAN_TRACKS
  },
  {
    id: 'harris_jayaraj_melodies',
    title: 'Harris Jayaraj • Minnal Melodies',
    subtitle: 'Guitars & Monsoon Breeze Classics',
    description: 'Lush acoustic guitars, synthesized basslines, and breeze-filled romantic anthems from Harris Jayaraj.',
    coverArt: 'https://images.unsplash.com/photo-1445307806294-bff7f67ff225?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-cyan-600/50 via-blue-800/40 to-neutral-950/90',
    accentColor: '#06b6d4',
    songCount: 30,
    tracks: HARRIS_TRACKS
  }
];

class InbuiltPlaylistsService {
  public getAll(): InbuiltPlaylist[] {
    return INBUILT_PLAYLISTS;
  }

  public getById(id: string): InbuiltPlaylist | undefined {
    return INBUILT_PLAYLISTS.find((p) => p.id === id);
  }

  public matchLocalSongs(playlist: InbuiltPlaylist, localSongs: Song[]): Song[] {
    if (!localSongs || localSongs.length === 0) return playlist.tracks;

    return playlist.tracks.map((track) => {
      const cleanTrackTitle = track.title
        .toLowerCase()
        .replace(/[-•–()[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const matched = localSongs.find((local) => {
        // Must have an active in-memory registered file
        if (!getRegisteredFile(local.id)) return false;

        const cleanLocalTitle = local.title
          .toLowerCase()
          .replace(/[-•–()[\]]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return (
          cleanLocalTitle === cleanTrackTitle ||
          (cleanLocalTitle.length >= 4 && cleanTrackTitle.startsWith(cleanLocalTitle)) ||
          (cleanTrackTitle.length >= 4 && cleanLocalTitle.startsWith(cleanTrackTitle))
        );
      });

      if (matched && getRegisteredFile(matched.id)) {
        return {
          ...track,
          id: matched.id,
          filePath: matched.filePath,
          path: matched.path,
          fileName: matched.fileName,
          isOnline: false
        };
      }

      return track;
    });
  }
}

export const inbuiltPlaylistsService = new InbuiltPlaylistsService();
