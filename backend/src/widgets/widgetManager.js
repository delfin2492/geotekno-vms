/**
 * Widget Manager
 * Mengelola widget modular dashboard yang dikustomisasi oleh user
 */

const { pool } = require('../db/pool');

class WidgetManager {
  async getAllWidgets(dashboardId = 'main') {
    try {
      const res = await pool.query(
        `SELECT w.*, a.name as asset_name 
         FROM core_widgets w
         LEFT JOIN core_assets a ON w.asset_id = a.id
         WHERE w.dashboard_id = $1 AND w.is_active = TRUE
         ORDER BY w.created_at ASC`,
        [dashboardId]
      );
      return res.rows;
    } catch (err) {
      console.warn('[WIDGETS WARN]', err.message);
      return [];
    }
  }

  async createWidget({ id, dashboard_id = 'main', title, widget_type, asset_id, config = {}, position = {} }) {
    const wId = id || `widget_${Date.now()}`;
    const res = await pool.query(
      `INSERT INTO core_widgets (id, dashboard_id, title, widget_type, asset_id, config, position, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING *`,
      [wId, dashboard_id, title, widget_type, asset_id, JSON.stringify(config), JSON.stringify(position)]
    );
    return res.rows[0];
  }

  async updateWidget(widgetId, { title, widget_type, asset_id, config, position, is_active }) {
    const res = await pool.query(
      `UPDATE core_widgets 
       SET title = COALESCE($2, title),
           widget_type = COALESCE($3, widget_type),
           asset_id = COALESCE($4, asset_id),
           config = COALESCE($5, config),
           position = COALESCE($6, position),
           is_active = COALESCE($7, is_active)
       WHERE id = $1
       RETURNING *`,
      [widgetId, title, widget_type, asset_id, config ? JSON.stringify(config) : null, position ? JSON.stringify(position) : null, is_active]
    );
    return res.rows[0];
  }

  async deleteWidget(widgetId) {
    await pool.query('DELETE FROM core_widgets WHERE id = $1', [widgetId]);
    return true;
  }
}

const widgetManager = new WidgetManager();

module.exports = {
  widgetManager,
};
