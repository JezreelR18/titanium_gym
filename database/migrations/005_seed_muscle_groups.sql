-- Migration 005: seed standard muscle groups (Spanish)
INSERT INTO muscle_groups (id, name, description) VALUES
    (gen_random_uuid(), 'Pecho',           'Músculos pectorales'),
    (gen_random_uuid(), 'Espalda',         'Músculos dorsales y trapecio'),
    (gen_random_uuid(), 'Hombros',         'Deltoides anterior, lateral y posterior'),
    (gen_random_uuid(), 'Bíceps',          'Bíceps braquial y braquiorradial'),
    (gen_random_uuid(), 'Tríceps',         'Tríceps braquial'),
    (gen_random_uuid(), 'Antebrazos',      'Flexores y extensores del antebrazo'),
    (gen_random_uuid(), 'Abdomen',         'Recto abdominal, oblicuos y core'),
    (gen_random_uuid(), 'Glúteos',         'Glúteo mayor, medio y menor'),
    (gen_random_uuid(), 'Cuádriceps',      'Músculos frontales del muslo'),
    (gen_random_uuid(), 'Isquiotibiales',  'Músculos posteriores del muslo'),
    (gen_random_uuid(), 'Pantorrillas',    'Gastrocnemio y sóleo'),
    (gen_random_uuid(), 'Cuerpo completo', 'Ejercicios que trabajan múltiples grupos musculares')
ON CONFLICT DO NOTHING;
