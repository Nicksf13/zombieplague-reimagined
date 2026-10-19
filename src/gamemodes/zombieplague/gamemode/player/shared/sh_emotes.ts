// IDs are part of the wire protocol. Keep them stable when extending the catalog.
export const Emotes: readonly ZPEmoteDefinition[] = [
    { ID: 1, Name: "dance", Activity: ACT_GMOD_TAUNT_DANCE },
    { ID: 2, Name: "robot", Activity: ACT_GMOD_TAUNT_ROBOT },
    { ID: 3, Name: "muscle", Activity: ACT_GMOD_TAUNT_MUSCLE },
    { ID: 4, Name: "cheer", Activity: ACT_GMOD_TAUNT_CHEER },
    { ID: 5, Name: "laugh", Activity: ACT_GMOD_TAUNT_LAUGH },
    { ID: 6, Name: "wave", Activity: ACT_GMOD_GESTURE_WAVE },
    { ID: 7, Name: "salute", Activity: ACT_GMOD_TAUNT_SALUTE },
    { ID: 8, Name: "zombie", Activity: ACT_GMOD_GESTURE_TAUNT_ZOMBIE },
    { ID: 9, Name: "agree", Activity: ACT_GMOD_GESTURE_AGREE },
    { ID: 10, Name: "disagree", Activity: ACT_GMOD_GESTURE_DISAGREE },
    { ID: 11, Name: "becon", Activity: ACT_GMOD_GESTURE_BECON },
    { ID: 12, Name: "bow", Activity: ACT_GMOD_GESTURE_BOW },
    { ID: 13, Name: "forward", Activity: ACT_SIGNAL_FORWARD },
    { ID: 14, Name: "group", Activity: ACT_SIGNAL_GROUP },
    { ID: 15, Name: "halt", Activity: ACT_SIGNAL_HALT },
    { ID: 16, Name: "pers", Activity: ACT_GMOD_TAUNT_PERSISTENCE },
];
