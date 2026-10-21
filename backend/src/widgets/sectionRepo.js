const { pool } = require('../db/pool');

const DEFAULT_SECTIONS = [
  {
    id: 'section-nav',
    name: 'Navigation & Maneuvering',
    description: 'Speed, heading, depth & navigation instruments',
    widgets: [],
    layouts: {},
    order_index: 1,
  },
  {
    id: 'section-engine',
    name: 'Engine & Machinery',
    description: 'Machinery status, propulsion RPM & fuel diagnostics',
    widgets: [],
    layouts: {},
    order_index: 2,
  },
  {
    id: 'section-bridge',
    name: 'Bridge Command Center',
    description: 'Consolidated command center navigation & radar console',
    widgets: [],
    layouts: {},
    order_index: 3,
  },
];

async function ensureDefaultSections() {
  const countRes = await pool.query('SELECT COUNT(*) FROM core_monitoring_sections');
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    for (const s of DEFAULT_SECTIONS) {
      await pool.query(
        `INSERT INTO core_monitoring_sections (id, name, description, widgets, layouts, order_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.description, JSON.stringify(s.widgets), JSON.stringify(s.layouts), s.order_index]
      );
    }
  }
}

async function getAllSections() {
  try {
    await ensureDefaultSections();
    const res = await pool.query(
      `SELECT id, name, description, widgets, layouts, order_index, created_at, updated_at
       FROM core_monitoring_sections
       ORDER BY order_index ASC, created_at ASC`
    );
    return res.rows.map(r => ({
      ...r,
      widgets: typeof r.widgets === 'string' ? JSON.parse(r.widgets) : (r.widgets || []),
      layouts: typeof r.layouts === 'string' ? JSON.parse(r.layouts) : (r.layouts || {}),
    }));
  } catch (err) {
    console.warn('[SECTION REPO WARN]', err.message);
    return DEFAULT_SECTIONS;
  }
}

async function saveAllSections(sections = []) {
  if (!Array.isArray(sections) || sections.length === 0) return getAllSections();

  for (let idx = 0; idx < sections.length; idx++) {
    const s = sections[idx];
    const id = s.id || `section_${Date.now()}_${idx}`;
    const name = s.name || `Section ${idx + 1}`;
    const desc = s.description || '';
    const widgets = JSON.stringify(s.widgets || []);
    const layouts = JSON.stringify(s.layouts || {});
    const orderIndex = idx + 1;

    await pool.query(
      `INSERT INTO core_monitoring_sections (id, name, description, widgets, layouts, order_index, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         widgets = EXCLUDED.widgets,
         layouts = EXCLUDED.layouts,
         order_index = EXCLUDED.order_index,
         updated_at = NOW()`,
      [id, name, desc, widgets, layouts, orderIndex]
    );
  }

  // Also remove sections from database if they were explicitly deleted in the payload
  const currentIds = sections.map(s => s.id).filter(Boolean);
  if (currentIds.length > 0) {
    await pool.query(
      `DELETE FROM core_monitoring_sections WHERE id NOT IN (${currentIds.map((_, i) => `$${i + 1}`).join(',')})`,
      currentIds
    );
  }

  return getAllSections();
}

async function upsertSection(section) {
  const id = section.id || `section_${Date.now()}`;
  const name = section.name || 'New Section';
  const desc = section.description || '';
  const widgets = JSON.stringify(section.widgets || []);
  const layouts = JSON.stringify(section.layouts || {});
  const orderIndex = section.order_index || 999;

  const res = await pool.query(
    `INSERT INTO core_monitoring_sections (id, name, description, widgets, layouts, order_index, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       widgets = EXCLUDED.widgets,
       layouts = EXCLUDED.layouts,
       order_index = EXCLUDED.order_index,
       updated_at = NOW()
     RETURNING id, name, description, widgets, layouts, order_index, created_at, updated_at`,
    [id, name, desc, widgets, layouts, orderIndex]
  );
  const r = res.rows[0];
  return {
    ...r,
    widgets: typeof r.widgets === 'string' ? JSON.parse(r.widgets) : (r.widgets || []),
    layouts: typeof r.layouts === 'string' ? JSON.parse(r.layouts) : (r.layouts || {}),
  };
}

async function deleteSection(id) {
  await pool.query('DELETE FROM core_monitoring_sections WHERE id = $1', [id]);
  return { success: true, deletedId: id };
}

module.exports = {
  getAllSections,
  saveAllSections,
  upsertSection,
  deleteSection,
};
