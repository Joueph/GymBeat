# Code Quality Audit

This audit captures the documentation pass baseline for core shared code. It is intentionally report-only for behavioral cleanup: no refactors or logic changes are bundled with the comment work.

## Current lint baseline

`npm run lint` currently reports 4 errors and 129 warnings.

High-priority categories:

- Missing display names in memoized components.
- React Hook dependency warnings.
- Unused variables and functions.
- `require()` imports inside modules.
- Loose equality in workout code.
- Import-order problems and duplicate imports.

`npx tsc --noEmit` currently fails on pre-existing type/scope issues:

- `app/(projetos)/[id].tsx` reads `user.uid` from `Usuario`, but the model exposes a different shape.
- `components/exercicios/ExpandableExerciseItem.tsx` and `utils/volumeUtils.ts` make `Serie.concluido` optional where the base interface requires it.
- `contexts/TimerContext.tsx` is missing a declaration for `react-native-background-timer`.
- `modules/notifications-live-activity/index.ts` returns `string | null` where `string` is required.
- `services/logService.ts` references `queueAndCache` from a catch block outside its function scope.

## Redundancy candidates

- Date parsing helpers are repeated across widgets, charts, friends data, workout screens, and history widgets. A shared `toDate` utility would reduce drift.
- Workout set cascade logic appears in both workout logging and workout editing flows. It should be extracted only after tests or focused QA exist for those flows.
- Duration/date/time formatting helpers are repeated across home widgets, past workouts, and workout editing screens.
- `services/treinoService.ts` has mid-file imports and duplicate/legacy comments, which makes the module harder to scan.
- `services/postService.ts` exposes `toggleLike`, but the function is effectively a placeholder while `likePost` and `unlikePost` do the real work.

## App directory findings

- `app/(projetos)/[id].tsx` uses `user.uid` in several places even though `useAuth()` returns `Usuario`, where the stable identifier is `id`.
- `app/customer-center.tsx` uses a manual RevenueCat customer-center screen. That may be fine, but the dependency capability should be verified before deciding whether to keep it manual or replace it with a native RevenueCat UI.
- `app/(auth)/registro.tsx`, `app/(treino)/LoggingDuringWorkout.tsx`, `app/(treino)/editarTreino.tsx`, and `app/(treino)/treinoCompleto.tsx` are large route files with mixed data loading, local components, mutation logic, and rendering.
- `app/(tabs)/index.tsx` calls `setFichaSelectorVisible(false)` twice inside `handleFichaSelect`.
- Dynamic `require()` calls in login, registration, workout selection, and workout completion should be moved to static imports where possible. Asset `require()` calls are less urgent, but service imports inside handlers are harder to type and test.
- `modalOverview.tsx` appears to check `conclido`/`concluido` inconsistently, which may cause completed-set calculations to be wrong.

## Bad-practice notes

- Several large route files mix data loading, business rules, animation state, component definitions, and rendering. The largest current examples are onboarding registration, active workout logging, workout editing, and workout completion.
- Many hook dependency warnings may hide stale-closure bugs. These should be fixed carefully, one screen at a time, because blindly adding dependencies can change behavior.
- Some services swallow errors and return empty arrays/null values. This can keep the UI alive, but it also makes failures hard to distinguish from empty data.
- `any` is common in service boundaries, cache deserialization, Firestore payloads, and config helpers. Tightening types would make future refactors safer.

## Deferred structural work

- Split very large screens into screen-level containers, focused hooks, and presentational components.
- Move repeated date/formatting helpers into shared utilities.
- Normalize service module layout so imports stay at the top and public functions have consistent contracts.
- Add focused tests around offline sync, workout save/finish, and friend request flows before changing behavior.
