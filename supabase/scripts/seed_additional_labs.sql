-- Additional schools and labs (no descriptions yet)

-- MIT ---------------------------------------------------------
insert into schools (id, name, slug, college, city, state, country)
values ('00000000-0000-0000-0000-000000000002', 'Massachusetts Institute of Technology', 'mit', 'School of Engineering', 'Cambridge', 'MA', 'USA')
on conflict (id) do nothing;

insert into labs (id, school_id, name, research_area, lab_url)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'Computer Architecture Group', 'Computer Architecture', 'https://www.csg.mit.edu/'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'Artificial Intelligence Lab (CSAIL)', 'Artificial Intelligence', 'https://www.csail.mit.edu/research/artificial-intelligence')
on conflict (id) do nothing;

insert into professors (lab_id, name, email, title) values
  ('00000000-0000-0000-0000-000000000201', 'Dr. Daniel Sanchez', null, 'Associate Professor'),
  ('00000000-0000-0000-0000-000000000201', 'Dr. Arvind', null, 'Professor'),
  ('00000000-0000-0000-0000-000000000202', 'Dr. Regina Barzilay', null, 'Professor')
on conflict do nothing;

-- Stanford -----------------------------------------------------
insert into schools (id, name, slug, college, city, state, country)
values ('00000000-0000-0000-0000-000000000003', 'Stanford University', 'stanford', 'School of Engineering', 'Stanford', 'CA', 'USA')
on conflict (id) do nothing;

insert into labs (id, school_id, name, research_area, lab_url)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000003', 'Stanford Architecture & AI Lab (AIML)', 'Computer Architecture', 'https://architecture.stanford.edu/'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000003', 'Stanford Vision Lab', 'Computer Vision', 'https://svl.stanford.edu/')
on conflict (id) do nothing;

insert into professors (lab_id, name, email, title) values
  ('00000000-0000-0000-0000-000000000301', 'Dr. Kunle Olukotun', null, 'Professor'),
  ('00000000-0000-0000-0000-000000000302', 'Dr. Fei-Fei Li', null, 'Professor')
on conflict do nothing; 