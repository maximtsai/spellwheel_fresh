// scripts/audioBank.js
// Merges the small sound-effect mp3s into a few larger "audio bank" files and
// emits a marker index, so dist/audio drops from ~158 files to a handful.
// Requires ffmpeg/ffprobe (https://ffmpeg.org). Runs automatically from build.js.
//
// How it works:
//   - Sounds that LOOP, and music tracks (>= MUSIC_SIZE_THRESHOLD), stay as
//     individual files (Phaser markers + looping is fragile; music is long).
//   - The rest are concatenated with ffmpeg into banks (resampled to a single
//     sample rate / layout, with a small silence gap between sounds).
//   - Durations are measured with ffprobe; the returned index maps each sound
//     name to { bank, start, duration } for Phaser's sound.addMarker().

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'audio');

const GAP = 0.05;           // seconds of silence between sounds in a bank
const LEAD_PAD = 0.1;       // leading silence per bank (encoder-delay safety)
const SAMPLE_RATE = 44100;
const BITRATE = '96k'; // close to sources' ~71 kbps effective rate
const MAX_BANK_BYTES = 1.5 * 1024 * 1024; // ~1.5 MB per bank

// Sounds used with loop=true anywhere in the game must stay individual files.
const LOOPED_SOUNDS = new Set([
    'wind', 'deepdemon', 'tractor_loop', 'bite_down_simplified',
    'mind_ultimate_loop_1', 'mind_ultimate_loop_2',
    'and_into_the_void', 'bite_down', 'bite_down_complex',
    'but_never_forgotten', 'but_never_forgotten_epicchoir',
    'but_never_forgotten_metal', 'death3_harp', 'echos_of_time',
    'heartbeat', 'into_the_void', 'jpop', 'magician_theme_1', 'magician_theme_4',
]);
// Files at or above this size are music tracks — keep them separate.
const MUSIC_SIZE_THRESHOLD = 300 * 1024;

function findBinary(name) {
    // Try PATH first (a fresh shell after installing ffmpeg works here).
    try {
        execFileSync(name, ['-version'], { stdio: 'ignore' });
        return name;
    } catch (e) { /* not on PATH */ }
    // Fall back to the WinGet package install location.
    const winGetBase = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(winGetBase)) {
        const stack = [winGetBase];
        while (stack.length) {
            const dir = stack.pop();
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    stack.push(full);
                } else if (entry.name === name + '.exe' || entry.name === name) {
                    return full;
                }
            }
        }
    }
    throw new Error(
        `Could not find ${name}. Install ffmpeg (e.g. "winget install -e --id Gyan.FFmpeg") ` +
        `or put it on PATH, then re-run the build.`
    );
}

function ffprobeDuration(ffprobe, file) {
    const out = execFileSync(ffprobe, [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
    ], { encoding: 'utf8' }).trim();
    const dur = parseFloat(out);
    if (!isFinite(dur) || dur <= 0) {
        throw new Error(`Could not measure duration of ${file} (got "${out}")`);
    }
    return dur;
}

function parseAudioFiles() {
    const code = fs.readFileSync(path.join(ROOT, 'audioFiles.js'), 'utf8');
    // audioFiles.js is `const audioFiles = [...];` — evaluate it in a sandbox.
    const fn = new Function(code + '\n; return audioFiles;');
    return fn();
}

function groupIntoBanks(entries) {
    const banks = [];
    let current = [];
    let currentBytes = 0;
    for (const entry of entries) {
        const bytes = fs.statSync(entry.src).size;
        if (current.length && currentBytes + bytes > MAX_BANK_BYTES) {
            banks.push(current);
            current = [];
            currentBytes = 0;
        }
        current.push(entry);
        currentBytes += bytes;
    }
    if (current.length) {
        banks.push(current);
    }
    return banks;
}

/**
 * Builds the audio banks into distAudioDir.
 * Returns { index, bankFiles, bankedSourceFiles } where:
 *   - index:  { soundName: { bank, start, duration } }
 *   - bankFiles: [ { name, src } ] for scene.load.audio
 *   - bankedSourceFiles: Set of source filenames that must NOT be copied to dist
 */
function buildAudioBanks(distAudioDir) {
    const ffmpeg = findBinary('ffmpeg');
    const ffprobe = findBinary('ffprobe');

    const all = parseAudioFiles();
    const keepIndividual = new Set();
    const bankable = [];
    for (const entry of all) {
        const bytes = fs.statSync(entry.src).size;
        if (LOOPED_SOUNDS.has(entry.name) || bytes >= MUSIC_SIZE_THRESHOLD) {
            keepIndividual.add(entry.name);
        } else {
            bankable.push(entry);
        }
    }

    // Dedupe by source file (time_strike / time_strike_alt share one file),
    // but keep every name pointing at the same bank marker.
    const bySrc = new Map();
    for (const e of bankable) {
        if (!bySrc.has(e.src)) bySrc.set(e.src, e);
    }
    const unique = [...bySrc.values()];

    const banks = groupIntoBanks(unique);
    const index = {};
    const bankFiles = [];
    const bankedSourceFiles = new Set();

    fs.mkdirSync(distAudioDir, { recursive: true });

    banks.forEach((entries, bankIdx) => {
        const bankName = 'bank' + bankIdx;
        const outFile = path.join(distAudioDir, bankName + '.mp3');

        // Measure durations first (input timeline == decoded timeline).
        const durations = entries.map((e) => ffprobeDuration(ffprobe, e.src));

        // Build the ffmpeg filter graph: resample/format each input, pad a gap,
        // then concat. A lead pad keeps the first marker out of encoder delay.
        const inputs = [];
        const chains = [];
        let offset = LEAD_PAD;
        entries.forEach((e, i) => {
            inputs.push('-i', e.src);
            chains.push(
                `[${i}:a]aresample=${SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo,` +
                `apad=pad_dur=${GAP}[a${i}]`
            );
            // Register every name for this source file (aliases included) at the
            // same bank marker.
            for (const entry of bankable) {
                if (entry.src === e.src) {
                    index[entry.name] = {
                        bank: bankName,
                        start: round3(offset),
                        duration: round3(durations[i]),
                    };
                }
            }
            offset += durations[i] + GAP;
            bankedSourceFiles.add(path.basename(e.src));
        });

        const lead = `anullsrc=r=${SAMPLE_RATE}:cl=stereo,atrim=duration=${LEAD_PAD}[lead]`;
        const concatInputs = ['[lead]'].concat(entries.map((_, i) => `[a${i}]`)).join('');
        const filter = `${lead};${chains.join(';')};${concatInputs}concat=n=${entries.length + 1}:v=0:a=1[out]`;

        execFileSync(ffmpeg, [
            '-y',
            ...inputs,
            '-filter_complex', filter,
            '-map', '[out]',
            '-c:a', 'libmp3lame', '-b:a', BITRATE,
            outFile,
        ], { stdio: ['ignore', 'ignore', 'inherit'] });

        bankFiles.push({ name: bankName, src: 'audio/' + bankName + '.mp3' });
        console.log(`  ${bankName}: ${entries.length} sounds -> ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`);
    });

    return { index, bankFiles, bankedSourceFiles, keptIndividual: [...keepIndividual] };
}

function round3(n) {
    return Math.round(n * 1000) / 1000;
}

module.exports = { buildAudioBanks };

// Standalone: node scripts/audioBank.js — writes into dist/audio and prints the index size.
if (require.main === module) {
    const distAudio = path.join(ROOT, 'dist', 'audio');
    const result = buildAudioBanks(distAudio);
    console.log(`Banked ${Object.keys(result.index).length} sounds into ${result.bankFiles.length} banks.`);
    console.log(`Kept individual: ${result.keptIndividual.join(', ')}`);
}
