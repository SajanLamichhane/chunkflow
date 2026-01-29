import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { UploadModule } from "./upload/upload.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [DatabaseModule, UploadModule],
  controllers: [HealthController],
})
export class AppModule {}
