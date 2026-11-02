const { pool } = require('../db/pool');

let hasEnsuredTable = false;

async function ensureTableStructure() {
  if (hasEnsuredTable) return;
  try {
    await pool.query(
      "ALTER TABLE core_monitoring_sections ADD COLUMN IF NOT EXISTS company_id VARCHAR(64) DEFAULT 'comp_geotekno'"
    );
    await pool.query(
      "UPDATE core_monitoring_sections SET company_id = 'comp_geotekno' WHERE company_id IS NULL OR company_id = ''"
    );
    hasEnsuredTable = true;
  } catch (err) {
    console.warn('[SECTION REPO] ensureTableStructure warn:', err.message);
  }
}

function createDefaultSectionsForCompany(companyId, assets = []) {
  if (assets.length > 0) {
    return assets.map((a, idx) => ({
      id: `sec_${companyId}_${a.id}`,
      name: a.name,
      description: `Speed, heading, depth & navigation instruments for ${a.name}`,
      company_id: companyId,
      widgets: [
        { id: `speed-${a.id}`, type: 'speed', title: 'Speed over ground', vesselId: a.id, attributeKey: 'sog' },
        { id: `heading-${a.id}`, type: 'heading', title: 'Heading & course', vesselId: a.id, attributeKey: 'heading', secondaryAttributeKey: 'cog' },
        { id: `depth-${a.id}`, type: 'telemetry', title: 'Water depth', vesselId: a.id, attributeKey: 'depth' },
        { id: `map-${a.id}`, type: 'map', title: 'Position preview', vesselId: a.id, attributeKey: 'position' },
      ],
      layouts: {
        lg: [
          { i: `speed-${a.id}`, x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: `heading-${a.id}`, x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: `depth-${a.id}`, x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
          { i: `map-${a.id}`, x: 0, y: 4, w: 12, h: 5, minW: 4, minH: 3 },
        ],
        md: [
          { i: `speed-${a.id}`, x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
          { i: `heading-${a.id}`, x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
          { i: `depth-${a.id}`, x: 0, y: 4, w: 8, h: 4, minW: 3, minH: 2 },
          { i: `map-${a.id}`, x: 0, y: 8, w: 8, h: 5, minW: 4, minH: 3 },
        ],
        sm: [
          { i: `speed-${a.id}`, x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
          { i: `heading-${a.id}`, x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
          { i: `depth-${a.id}`, x: 0, y: 4, w: 8, h: 3, minW: 3, minH: 2 },
          { i: `map-${a.id}`, x: 0, y: 7, w: 8, h: 5, minW: 4, minH: 3 },
        ],
        xs: [
          { i: `speed-${a.id}`, x: 0, y: 0, w: 1, h: 4 },
          { i: `heading-${a.id}`, x: 0, y: 4, w: 1, h: 4 },
          { i: `depth-${a.id}`, x: 0, y: 8, w: 1, h: 3 },
          { i: `map-${a.id}`, x: 0, y: 11, w: 1, h: 4 },
        ],
      },
      order_index: idx + 1,
    }));
  }

  return [
    {
      id: `sec_${companyId}_nav`,
      name: 'Navigation & Maneuvering',
      description: 'Speed, heading, depth & navigation instruments',
      company_id: companyId,
      widgets: [
        { id: `speed-${companyId}`, type: 'speed', title: 'Speed over ground', vesselId: '', attributeKey: 'sog' },
        { id: `heading-${companyId}`, type: 'heading', title: 'Heading & course', vesselId: '', attributeKey: 'heading', secondaryAttributeKey: 'cog' },
        { id: `depth-${companyId}`, type: 'telemetry', title: 'Water depth', vesselId: '', attributeKey: 'depth' },
        { id: `map-${companyId}`, type: 'map', title: 'Position preview', vesselId: '', attributeKey: 'position' },
      ],
      layouts: {
        lg: [
          { i: `speed-${companyId}`, x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: `heading-${companyId}`, x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
          { i: `depth-${companyId}`, x: 6, y: 0, w: 6, h: 4, minW: 3, minH: 2 },
          { i: `map-${companyId}`, x: 0, y: 4, w: 12, h: 5, minW: 4, minH: 3 },
        ],
      },
      order_index: 1,
    },
  ];
}

async function getAllSections(companyId = null, isSuperadmin = false) {
  try {
    await ensureTableStructure();

    let query = `
      SELECT id, name, description, widgets, layouts, order_index, company_id, created_at, updated_at
      FROM core_monitoring_sections
    `;
    const params = [];

    if (companyId && (!isSuperadmin || companyId !== 'all')) {
      query += ' WHERE company_id = $1 ORDER BY order_index ASC, created_at ASC';
      params.push(companyId);
    } else {
      query += ' ORDER BY order_index ASC, created_at ASC';
    }

    const res = await pool.query(query, params);

    // If a specific tenant requested sections and has none in database yet, auto-provision for their fleet
    if (res.rows.length === 0 && companyId && companyId !== 'all') {
      const assetsRes = await pool.query(
        'SELECT id, name FROM core_assets WHERE company_id = $1',
        [companyId]
      );
      const defaults = createDefaultSectionsForCompany(companyId, assetsRes.rows);

      for (const s of defaults) {
        await pool.query(
          `INSERT INTO core_monitoring_sections (id, name, description, widgets, layouts, order_index, company_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [s.id, s.name, s.description, JSON.stringify(s.widgets), JSON.stringify(s.layouts), s.order_index, companyId]
        );
      }
      return defaults;
    }

    return res.rows.map((r) => ({
      ...r,
      companyId: r.company_id,
      widgets: typeof r.widgets === 'string' ? JSON.parse(r.widgets) : (r.widgets || []),
      layouts: typeof r.layouts === 'string' ? JSON.parse(r.layouts) : (r.layouts || {}),
    }));
  } catch (err) {
    console.warn('[SECTION REPO WARN]', err.message);
    return createDefaultSectionsForCompany(companyId || 'comp_geotekno');
  }
}

async function saveAllSections(sections = [], companyId = 'comp_geotekno') {
  await ensureTableStructure();
  const targetComp = companyId || 'comp_geotekno';

  if (!Array.isArray(sections) || sections.length === 0) {
    return getAllSections(targetComp);
  }

  for (let idx = 0; idx < sections.length; idx++) {
    const s = sections[idx];
    const id = s.id || `section_${targetComp}_${Date.now()}_${idx}`;
    const name = s.name || `Section ${idx + 1}`;
    const desc = s.description || '';
    const widgets = JSON.stringify(s.widgets || []);
    const layouts = JSON.stringify(s.layouts || {});
    const orderIndex = idx + 1;
    const itemComp = s.company_id || s.companyId || targetComp;

    await pool.query(
      `INSERT INTO core_monitoring_sections (id, name, description, widgets, layouts, order_index, company_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         widgets = EXCLUDED.widgets,
         layouts = EXCLUDED.layouts,
         order_index = EXCLUDED.order_index,
         company_id = EXCLUDED.company_id,
         updated_at = NOW()`,
      [id, name, desc, widgets, layouts, orderIndex, itemComp]
    );
  }

  // Remove sections from database if they were deleted within this company's scope
  const currentIds = sections.map((s) => s.id).filter(Boolean);
  if (currentIds.length > 0) {
    await pool.query(
      `DELETE FROM core_monitoring_sections WHERE company_id = $1 AND id NOT IN (${currentIds
        .map((_, i) => `$${i + 2}`)
        .join(',')})`,
      [targetComp, ...currentIds]
    );
  }

  return getAllSections(targetComp);
}

async function upsertSection(section, companyId = 'comp_geotekno') {
  await ensureTableStructure();
  const targetComp = section.company_id || section.companyId || companyId || 'comp_geotekno';
  const id = section.id || `section_${targetComp}_${Date.now()}`;
  const name = section.name || 'New Section';
  const desc = section.description || '';
  const widgets = JSON.stringify(section.widgets || []);
  const layouts = JSON.stringify(section.layouts || {});
  const orderIndex = section.order_index || 999;

  const res = await pool.query(
    `INSERT INTO core_monitoring_sections (id, name, description, widgets, layouts, order_index, company_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       widgets = EXCLUDED.widgets,
       layouts = EXCLUDED.layouts,
       order_index = EXCLUDED.order_index,
       company_id = EXCLUDED.company_id,
       updated_at = NOW()
     RETURNING id, name, description, widgets, layouts, order_index, company_id, created_at, updated_at`,
    [id, name, desc, widgets, layouts, orderIndex, targetComp]
  );
  const r = res.rows[0];
  return {
    ...r,
    companyId: r.company_id,
    widgets: typeof r.widgets === 'string' ? JSON.parse(r.widgets) : (r.widgets || []),
    layouts: typeof r.layouts === 'string' ? JSON.parse(r.layouts) : (r.layouts || {}),
  };
}

async function deleteSection(id, companyId = null) {
  await ensureTableStructure();
  if (companyId) {
    await pool.query('DELETE FROM core_monitoring_sections WHERE id = $1 AND company_id = $2', [id, companyId]);
  } else {
    await pool.query('DELETE FROM core_monitoring_sections WHERE id = $1', [id]);
  }
  return { success: true, deletedId: id };
}

module.exports = {
  getAllSections,
  saveAllSections,
  upsertSection,
  deleteSection,
};
