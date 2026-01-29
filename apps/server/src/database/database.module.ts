import { Module, Global } from "@nestjs/common";
import { Pool } from "pg";

export const DATABASE_POOL = "DATABASE_POOL";

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        // Use environment variable or default to localhost with current user (no password)
        const connectionString =
          process.env.DATABASE_URL ||
          `postgresql://${process.env.USER || "postgres"}@localhost:5432/chunkflow`;

        const pool = new Pool({
          connectionString,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        pool.on("error", (err) => {
          console.error("Unexpected database error:", err);
        });

        return pool;
      },
    },
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
