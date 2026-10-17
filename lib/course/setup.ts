// Module 0, "Set up your workshop": a lesson with no quiz. Learners finish it
// by ticking "My setup works" (public.complete_setup()), which unlocks Module 1
// through the usual gate.
export const SETUP_MODULE_ID = "m00";
export const isSetupModule = (id: string) => id === SETUP_MODULE_ID;
