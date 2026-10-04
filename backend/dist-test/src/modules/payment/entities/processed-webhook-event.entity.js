"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessedWebhookEvent = void 0;
const typeorm_1 = require("typeorm");
let ProcessedWebhookEvent = class ProcessedWebhookEvent {
    eventId;
    eventType;
    processedAt;
};
exports.ProcessedWebhookEvent = ProcessedWebhookEvent;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'event_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ProcessedWebhookEvent.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], ProcessedWebhookEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'processed_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProcessedWebhookEvent.prototype, "processedAt", void 0);
exports.ProcessedWebhookEvent = ProcessedWebhookEvent = __decorate([
    (0, typeorm_1.Entity)('processed_webhook_events')
], ProcessedWebhookEvent);
