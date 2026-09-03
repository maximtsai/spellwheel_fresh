const customAudioSrc = {
    time_strike_alt: 'time_strike',
    timeSlow: 'timeslow',
    lesserfall: 'lesser_fall',
    chirpmany: 'chirp_many',
    watersplash: 'water_splash',
    watersplashbig: 'water_splash_big',
};
const makeAudio = name => ({ name, src: 'audio/' + (customAudioSrc[name] || name) + '.mp3' });

const audioFiles = [
    'glass_break', 'button', 'emergency', 'fizzle', 'zoomin', 'magic',
    'power_surge', 'power_surge_plain', 'tree_timber', 'tree_sfx', 'tree_rustle',
    'razor_leaf', 'tree_hit', 'clunk', 'clunk2', 'cutesy_down', 'cutesy_up',
    'goblin_aha', 'goblin_grunt', 'enemy_attack', 'enemy_attack_2', 'enemy_attack_major',
    'body_slam', 'punch', 'punch2', 'sword_slice', 'sword_hit', 'wind',
    'water_drop', 'locket_open', 'locket_close', 'sound_of_death', 'you_died',
    'missile_launch_1', 'missile_launch_2', 'guncock', 'derp', 'inflate', 'balloon',
    'death_attack', 'death_cast', 'bite_down', 'bite_down_simplified', 'bite_down_complex',
    'and_into_the_void', 'into_the_void', 'echos_of_time', 'echos_of_time_finale',
    'metaljpop', 'metaljpop_short', 'jpop', 'jpop_intro', 'heartbeat',
    'but_never_forgotten_metal', 'but_never_forgotten_metal_prelude', 'but_never_forgotten_epicchoir',
    'but_never_forgotten', 'but_never_forgotten_afterthought', 'sleepless', 'sleepless_long',
    'death3_harp', 'matter_body', 'matter_enhance', 'matter_enhance_2', 'matter_shield',
    'matter_strike', 'matter_strike_alt', 'matter_strike_heavy', 'matter_strike_hit',
    'matter_strike_hit_alt', 'matter_strike_hit_alt_2', 'matter_strike_hit2', 'matter_ultimate',
    'mind_strike', 'mind_strike_hit', 'mind_enhance', 'mind_shield', 'mind_shield_retaliate',
    'mind_ultimate_1', 'mind_ultimate_2', 'mind_ultimate_cast', 'mind_ultimate_loop_1',
    'mind_ultimate_loop_2', 'thunder', 'clocktick1', 'time_hard', 'time_body',
    'time_strike_buff', 'time_strike', 'time_strike_alt', 'time_strike_hit', 'time_strike_hit_2',
    'time_enhance', 'time_shield', 'void_strike', 'void_strike_hit', 'void_body',
    'void_shield', 'void_ultimate', 'void_enhance', 'meat_click_left', 'meat_click_right',
    'victory', 'victory_2', 'victory_false', 'voca_hello', 'voca_shock',
    'voca_short_pain', 'voca_hello_short', 'voca_pain', 'voca_missile', 'voca_missile_broken',
    'voca_kya_damaged', 'voca_kya', 'voca_gun', 'voca_laser', 'voca_laser_broken',
    'voca_claw_1', 'voca_claw_2', 'big_gun_pow_1', 'big_gun_pow_2', 'robot_sfx_1',
    'robot_sfx_2', 'robot_laser', 'explosion', 'magician_theme_1', 'magician_theme_3',
    'magician_theme_4', 'gunsequence', 'shield_block', 'shield_break', 'rock_crumble',
    'tractor_start', 'tractor_loop', 'timeSlow', 'squish', 'lesserfall',
    'flip1', 'flip2', 'flip3', 'button_hover', 'button_click', 'whoosh', 'slice_in',
    'swish', 'heartbeatfast', 'stomp', 'deep_swish', 'ringknell', 'roar', 'click',
    'chirp1', 'chirpmany', 'deepdemon', 'boing', 'water1', 'water2', 'watersplash', 'watersplashbig'
].map(makeAudio);

// Assets loaded after the game starts (deferred), e.g. to reduce initial load time.
const deferredAudioFiles = [
    'jpop', 'bite_down_complex', 'death3_harp', 'and_into_the_void',
    'but_never_forgotten_epicchoir', 'tractor_loop', 'mind_ultimate_loop_1',
    'mind_ultimate_loop_2', 'wind', 'deepdemon', 'magician_theme_4',
    'heartbeat', 'but_never_forgotten_metal', 'into_the_void', 'but_never_forgotten'
].map(makeAudio);
