
// import { DataSource, type DataSourceOptions } from "typeorm";
// import { ENTITIES } from "./entities";

// import dotenv from "dotenv";

// //load the dotenv file
// dotenv.config();

// const config: DataSourceOptions = {
//     type: "postgres",
//     host: process.env.DATABASE_HOST!,
//     port: Number(process.env.DATABASE_PORT)!,
//     database: process.env.DATABASE_NAME!,
//     username: process.env.DATABASE_USER!,
//     password: process.env.DATABASE_PASSWORD!,
//     entities: ENTITIES,
//     migrations: [],  // Local migrations directory
//     synchronize: true,
//     logging: true
// };

// export default new DataSource({
//     ...config
// });

import { readFileSync } from 'node:fs';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import dotenv from 'dotenv';

dotenv.config();

const sslEnabled = process.env.DATABASE_SSL === 'true';
const caPath = process.env.DATABASE_CA_PATH;

if (sslEnabled && !caPath) {
    throw new Error(
        'DATABASE_CA_PATH is required when DATABASE_SSL=true'
    );
}

const config: DataSourceOptions = {
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME,
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,

    ssl: sslEnabled
        ? {
            rejectUnauthorized: true,
            ca: readFileSync(caPath!, 'utf8')
          }
        : false,

    entities: ENTITIES,
    migrations: [],

    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true'
};

export default new DataSource(config);
