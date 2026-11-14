-- The +/- weight step was replaced by typing the weight; nothing reads or writes this column.
alter table public.exercises drop column if exists weight_step;
