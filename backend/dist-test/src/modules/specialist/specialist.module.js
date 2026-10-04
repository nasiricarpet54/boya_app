"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecialistModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const specialist_controller_1 = require("./specialist.controller");
const specialist_entity_1 = require("./entities/specialist.entity");
const specialist_service_1 = require("./specialist.service");
let SpecialistModule = class SpecialistModule {
};
exports.SpecialistModule = SpecialistModule;
exports.SpecialistModule = SpecialistModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([specialist_entity_1.Specialist])],
        controllers: [specialist_controller_1.SpecialistController],
        providers: [specialist_service_1.SpecialistService],
        exports: [specialist_service_1.SpecialistService],
    })
], SpecialistModule);
