
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HealthCheck = sequelize.define(
  'HealthCheck',
  {
    check_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    Datetime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'health_checks', //  the table name
    timestamps: false,
  }
);

module.exports = HealthCheck;
