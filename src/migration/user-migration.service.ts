import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository, InjectConnection } from "@nestjs/typeorm";

import { Repository, Connection } from "typeorm";

import { UserEntity } from "@/user/user.entity";
import { UserService } from "@/user/user.service";
import { AuthService } from "@/auth/auth.service";

import { UserMigrationInfoEntity } from "./user-migration-info.entity";

@Injectable()
export class UserMigrationService {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
    @InjectRepository(UserMigrationInfoEntity)
    private readonly userMigrationInfoRepository: Repository<UserMigrationInfoEntity>,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService
  ) {}

  async findUserMigrationInfoByOldUsername(oldUsername: string): Promise<UserMigrationInfoEntity> {
    return await this.userMigrationInfoRepository.findOne({
      oldUsername
    });
  }

  async migrateUser(
    userMigrationInfo: UserMigrationInfoEntity,
    newUsername: string,
    newPassword: string
  ): Promise<UserEntity> {
    const user = await this.userService.findUserById(userMigrationInfo.userId);
    const userAuth = await this.authService.findUserAuthByUserId(user.id);

    await this.connection.transaction("READ COMMITTED", async transactionalEntityManager => {
      if (userMigrationInfo.usernameMustChange) {
        user.username = newUsername;
        await transactionalEntityManager.save(user);
      }

      await this.authService.changePassword(userAuth, newPassword, transactionalEntityManager);

      userMigrationInfo.migrated = true;
      await transactionalEntityManager.save(userMigrationInfo);
    });

    return user;
  }
}