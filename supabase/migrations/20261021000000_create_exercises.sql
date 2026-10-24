-- Exercise library: built-in exercises for injury healing and prevention
-- (user_id is null) plus any exercises people add for themselves.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null default 'strength'
    check (category in ('mobility', 'stability', 'strength', 'stretch')),
  -- 'healing' (rehab after an injury) and/or 'prevention'.
  purposes text[] not null default '{}',
  -- Keys shared with the body map: neck, shoulder, chest, upper_back,
  -- lower_back, core, elbow, wrist_hand, hip, glute, hamstring, quad, knee,
  -- calf, ankle_foot.
  body_regions text[] not null default '{}',
  dosage text,
  equipment text,
  description text,
  steps text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index exercises_builtin_name_idx
  on public.exercises (lower(name))
  where user_id is null;

create unique index exercises_user_name_idx
  on public.exercises (user_id, lower(name))
  where user_id is not null;

alter table public.exercises enable row level security;

create policy "Everyone signed in can read built-in exercises and their own"
  on public.exercises for select
  to authenticated
  using (user_id is null or (select auth.uid()) = user_id);

create policy "Users can create their own exercises"
  on public.exercises for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own exercises"
  on public.exercises for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own exercises"
  on public.exercises for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Sets remember which library exercise they were, when there was one.
alter table public.workout_sets
  add column exercise_id uuid references public.exercises (id) on delete set null;

insert into public.exercises
  (user_id, name, category, purposes, body_regions, dosage, equipment, description, steps)
values
  (null, 'Chin tuck', 'stability', '{healing,prevention}', '{neck,upper_back}', '2 × 10, hold 5 sec', null,
   'Strengthens the deep neck flexors and counters forward-head posture from screens and desks.',
   '{"Sit or stand tall, looking straight ahead.","Glide your chin straight back, making a double chin, without tipping your head down.","Hold, then relax forward."}'),
  (null, 'Neck isometrics', 'strength', '{healing}', '{neck}', '5 × 10 sec each direction', null,
   'Builds neck strength without moving a sore neck. A gentle first step after a strain.',
   '{"Place a hand on your forehead.","Press your head into your hand at about a third of your effort without letting it move.","Repeat pressing backward and to each side."}'),
  (null, 'Pendulum swing', 'mobility', '{healing}', '{shoulder}', '1 min each direction', null,
   'Lets a painful or stiff shoulder move without using its muscles. Common early in shoulder rehab.',
   '{"Lean forward with your good hand on a table.","Let the sore arm hang straight down, relaxed.","Rock your body so the arm swings in small circles, then side to side."}'),
  (null, 'Band external rotation', 'strength', '{healing,prevention}', '{shoulder}', '3 × 12 each side', 'Resistance band',
   'Strengthens the rotator cuff, which keeps the shoulder joint centered during pressing and overhead work.',
   '{"Anchor a band at elbow height and stand side-on to it.","Keep your elbow bent 90° and tucked to your side (a rolled towel helps).","Rotate your forearm out away from your belly, then return slowly."}'),
  (null, 'Band pull-apart', 'strength', '{prevention}', '{shoulder,upper_back}', '3 × 15', 'Resistance band',
   'Strengthens the upper back and rear shoulders to balance out pushing and sitting.',
   '{"Hold a band at shoulder height with straight arms, hands shoulder-width apart.","Pull the band apart until it touches your chest, squeezing your shoulder blades together.","Return slowly."}'),
  (null, 'Wall slide', 'mobility', '{healing,prevention}', '{shoulder,upper_back}', '2 × 10', null,
   'Improves overhead shoulder movement and shoulder-blade control.',
   '{"Stand with your back to a wall, forearms on the wall in a goalpost position.","Slide your arms up as high as you can while keeping your forearms and lower back against the wall.","Slide back down slowly."}'),
  (null, 'Scapular push-up', 'stability', '{prevention}', '{shoulder,upper_back}', '2 × 12', null,
   'Trains the serratus anterior, which keeps the shoulder blade stable against your ribs.',
   '{"Get into a push-up or knee push-up position with straight arms.","Let your chest sink between your shoulder blades without bending your elbows.","Push the floor away to spread your shoulder blades apart."}'),
  (null, 'Prone Y-T-W raise', 'strength', '{prevention}', '{upper_back,shoulder}', '2 × 8 of each letter', null,
   'Strengthens the lower and middle traps that support healthy shoulder movement.',
   '{"Lie face down with your forehead on a towel.","With thumbs up, raise your arms into a Y, then lower.","Repeat with arms out in a T, then elbows bent into a W."}'),
  (null, 'Doorway pec stretch', 'stretch', '{prevention}', '{chest,shoulder}', '3 × 30 sec each side', null,
   'Opens up a tight chest that pulls the shoulders forward.',
   '{"Place your forearm on a door frame with the elbow at shoulder height.","Step through gently until you feel a stretch across the chest.","Breathe and hold; don''t force it."}'),
  (null, 'Thoracic extension on foam roller', 'mobility', '{prevention}', '{upper_back}', '1–2 min', 'Foam roller',
   'Restores upper-back extension, taking strain off the neck, shoulders and lower back.',
   '{"Lie with a foam roller across your upper back, hands supporting your head.","Keep your hips down and gently arch back over the roller.","Move the roller an inch at a time between the shoulder blades."}'),
  (null, 'Cat-cow', 'mobility', '{healing,prevention}', '{lower_back,upper_back}', '2 × 10', null,
   'Gently moves the whole spine. A good warm-up and easy relief for a stiff back.',
   '{"Start on hands and knees.","Breathe in as you drop your belly and lift your chest and tailbone.","Breathe out as you round your back toward the ceiling."}'),
  (null, 'Bird dog', 'stability', '{healing,prevention}', '{lower_back,core,glute}', '3 × 8 each side, hold 3 sec', null,
   'Builds back and core endurance with very little load on the spine. A staple of low-back rehab.',
   '{"Start on hands and knees with a flat back.","Reach one arm forward and the opposite leg back without letting your hips rotate.","Hold, return, and switch sides."}'),
  (null, 'Dead bug', 'stability', '{prevention}', '{core,lower_back}', '3 × 8 each side', null,
   'Teaches your core to keep the lower back steady while the arms and legs move.',
   '{"Lie on your back with arms up and knees bent 90° over your hips.","Press your lower back gently into the floor.","Lower one arm and the opposite leg toward the floor, then switch."}'),
  (null, 'McGill curl-up', 'stability', '{healing}', '{core,lower_back}', '3 × 5, hold 10 sec', null,
   'Works the abs without bending the lower spine, so it''s friendly to sore backs.',
   '{"Lie on your back with one knee bent and one leg straight, hands under your lower back.","Brace your abs and lift your head and shoulders a few inches as one unit.","Hold, keeping your neck neutral, then lower."}'),
  (null, 'Side plank', 'stability', '{prevention}', '{core,hip,lower_back}', '3 × 20–45 sec each side', null,
   'Strengthens the side core and hip muscles that stabilize the spine and pelvis.',
   '{"Lie on your side propped on your elbow, knees bent (easier) or legs straight.","Lift your hips so your body is in a straight line.","Hold without letting your hips sag."}'),
  (null, 'Pallof press', 'stability', '{prevention}', '{core}', '3 × 10 each side', 'Resistance band or cable',
   'Trains the core to resist twisting, which protects the lower back.',
   '{"Stand side-on to a band anchored at chest height, holding it at your chest.","Press your hands straight out without letting the band rotate you.","Pause, bring it back, and repeat."}'),
  (null, 'Glute bridge', 'strength', '{healing,prevention}', '{glute,hip,lower_back,hamstring}', '3 × 12', null,
   'Wakes up and strengthens the glutes, which support the lower back, hips and knees.',
   '{"Lie on your back with knees bent and feet flat.","Squeeze your glutes and lift your hips until your body is straight from shoulders to knees.","Pause at the top, then lower slowly."}'),
  (null, 'Clamshell', 'strength', '{healing,prevention}', '{hip,glute,knee}', '3 × 15 each side', 'Resistance band (optional)',
   'Strengthens the side glute, which keeps the knee from caving in. Often prescribed for knee and hip pain.',
   '{"Lie on your side with hips and knees bent, feet together.","Keeping your feet touching, lift your top knee without rolling your hips back.","Lower slowly."}'),
  (null, 'Half-kneeling hip flexor stretch', 'stretch', '{prevention}', '{hip,lower_back,quad}', '3 × 30 sec each side', null,
   'Loosens hip flexors that tighten from sitting and can pull on the lower back.',
   '{"Kneel on one knee with the other foot in front.","Tuck your tailbone under and squeeze the glute of the kneeling leg.","Shift forward slightly until you feel a stretch at the front of the hip."}'),
  (null, '90/90 hip switch', 'mobility', '{prevention}', '{hip}', '2 × 8 each side', null,
   'Improves hip rotation in both directions.',
   '{"Sit with both knees bent 90°, one leg in front and one to the side.","Keeping your feet planted, rotate both knees over to the other side.","Sit tall and move slowly."}'),
  (null, 'Copenhagen plank', 'strength', '{prevention}', '{hip}', '3 × 15–30 sec each side', 'Bench',
   'Strengthens the inner thigh. Shown to cut groin injuries in field sports.',
   '{"Lie on your side with your top leg resting on a bench (knee on the bench is easier).","Lift your hips so your body is straight, supported by your top leg and forearm.","Hold, then lower."}'),
  (null, 'Nordic hamstring curl', 'strength', '{prevention}', '{hamstring}', '3 × 5', 'Partner or anchor for your heels',
   'Eccentric hamstring strength. One of the best-studied ways to prevent hamstring strains.',
   '{"Kneel with your heels held down by a partner or anchor.","Keeping your hips straight, lower your body forward as slowly as you can.","Catch yourself with your hands and push back up."}'),
  (null, 'Single-leg Romanian deadlift', 'stability', '{prevention}', '{hamstring,hip,glute,ankle_foot}', '3 × 8 each side', 'Dumbbell (optional)',
   'Builds hamstring strength and balance on one leg.',
   '{"Stand on one leg with a soft knee.","Hinge at the hips, reaching your hands down as your other leg extends behind you.","Keep your hips level, then stand back up."}'),
  (null, 'Straight leg raise', 'strength', '{healing}', '{quad,knee}', '3 × 12 each side', null,
   'Strengthens the quads without bending the knee. An early exercise after knee injuries or surgery.',
   '{"Lie on your back with one knee bent and the other leg straight.","Tighten the thigh of the straight leg and lift it to the height of the other knee.","Lower slowly."}'),
  (null, 'Terminal knee extension', 'strength', '{healing}', '{knee,quad}', '3 × 15 each side', 'Resistance band',
   'Strengthens the last few degrees of knee straightening, which often go missing after injury.',
   '{"Loop a band behind your knee and anchor it in front of you.","Start with the knee slightly bent.","Straighten the knee fully against the band, squeezing your thigh, then relax."}'),
  (null, 'Spanish squat', 'strength', '{healing}', '{knee,quad}', '5 × 45 sec hold', 'Heavy band',
   'An isometric hold that often eases kneecap tendon (patellar tendinopathy) pain.',
   '{"Loop a heavy band behind both knees and anchor it in front of you.","Lean back into the band and sit down with your shins vertical.","Hold at a depth that feels strong, not painful."}'),
  (null, 'Step-down', 'stability', '{healing,prevention}', '{knee,hip,quad}', '3 × 10 each side', 'Step',
   'Trains control of the knee over the foot when going down stairs or landing.',
   '{"Stand on a step on one leg.","Slowly lower the other heel toward the floor, keeping your knee in line with your toes.","Tap and come back up."}'),
  (null, 'Eccentric calf raise', 'strength', '{healing}', '{calf,ankle_foot}', '3 × 15', 'Step',
   'Slow lowering on a step. A classic program for Achilles tendon pain.',
   '{"Stand on the edge of a step on the balls of your feet.","Rise up on both feet.","Shift onto one foot and lower your heel below the step slowly over about 3 seconds."}'),
  (null, 'Single-leg balance', 'stability', '{healing,prevention}', '{ankle_foot,knee}', '3 × 30 sec each side', null,
   'Retrains ankle reflexes. Proven to lower the chance of spraining the same ankle again.',
   '{"Stand on one foot near something to hold.","Keep a soft knee and stay tall.","Make it harder by closing your eyes or standing on a cushion."}'),
  (null, 'Ankle alphabet', 'mobility', '{healing}', '{ankle_foot}', '1 round each foot', null,
   'Gently brings back ankle movement after a sprain.',
   '{"Sit with your leg out and foot off the ground.","Trace the letters A to Z with your big toe.","Move from the ankle, not the knee."}'),
  (null, 'Knee-to-wall ankle mobilization', 'mobility', '{prevention}', '{ankle_foot,calf}', '2 × 10 each side', null,
   'Improves ankle bend for squats and running, which takes stress off the knees.',
   '{"Face a wall in a split stance, front toes a few inches from it.","Drive the front knee forward to touch the wall without lifting your heel.","Move your foot back as it gets easier."}'),
  (null, 'Short foot', 'strength', '{healing,prevention}', '{ankle_foot}', '3 × 10, hold 5 sec', null,
   'Strengthens the small muscles of the arch. Helpful for plantar fasciitis and flat feet.',
   '{"Sit or stand with your foot flat.","Without curling your toes, pull the ball of your foot toward your heel to raise the arch.","Hold, then relax."}'),
  (null, 'Wrist flexor and extensor stretch', 'stretch', '{healing,prevention}', '{wrist_hand,elbow}', '3 × 30 sec each', null,
   'Relieves tight forearms from typing, gripping and climbing.',
   '{"Hold your arm straight out, palm up.","With the other hand, gently pull your fingers back toward you and hold.","Turn your palm down and gently bend the wrist down and hold."}'),
  (null, 'Eccentric wrist extension', 'strength', '{healing}', '{elbow,wrist_hand}', '3 × 15', 'Light dumbbell',
   'Slow lowering for the forearm tendons. The go-to exercise for tennis elbow.',
   '{"Rest your forearm on your thigh, palm down, holding a light weight.","Use the other hand to help lift the weight up.","Lower it slowly with the sore wrist alone over about 3 seconds."}');
