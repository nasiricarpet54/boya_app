"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const loyalty_controller_1 = require("./controllers/loyalty.controller");
const referral_controller_1 = require("./controllers/referral.controller");
const referral_cron_1 = require("./cron/referral.cron");
const loyalty_point_entity_1 = require("./entities/loyalty-point.entity");
const referral_entity_1 = require("./entities/referral.entity");
const referral_listener_1 = require("./listeners/referral.listener");
const loyalty_point_service_1 = require("./services/loyalty-point.service");
const referral_code_service_1 = require("./services/referral-code.service");
const referral_service_1 = require("./services/referral.service");
let ReferralModule = class ReferralModule {
};
exports.ReferralModule = ReferralModule;
exports.ReferralModule = ReferralModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([referral_entity_1.Referral, loyalty_point_entity_1.LoyaltyPoint])],
        controllers: [referral_controller_1.ReferralController, loyalty_controller_1.LoyaltyController],
        providers: [referral_service_1.ReferralService, loyalty_point_service_1.LoyaltyPointService, referral_code_service_1.ReferralCodeService, referral_listener_1.ReferralListener, referral_cron_1.ReferralCron],
        exports: [referral_service_1.ReferralService, loyalty_point_service_1.LoyaltyPointService],
    })
], ReferralModule);
