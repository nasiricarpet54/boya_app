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
var ApprovalsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalsService = exports.APPROVAL_TYPES = exports.APPROVAL_STATUSES = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const approval_status_1 = require("../../../common/approval-status");
Object.defineProperty(exports, "APPROVAL_STATUSES", { enumerable: true, get: function () { return approval_status_1.APPROVAL_STATUSES; } });
Object.defineProperty(exports, "APPROVAL_TYPES", { enumerable: true, get: function () { return approval_status_1.APPROVAL_TYPES; } });
let ApprovalsService = ApprovalsService_1 = class ApprovalsService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    requireAdmin(user) {
        if (!user || user.role !== 'admin') {
            throw new common_1.ForbiddenException('این بخش فقط برای مدیر سامان است');
        }
    }
    static assertType(value) {
        if (!value || !approval_status_1.APPROVAL_TYPES.includes(value)) {
            throw new common_1.BadRequestException(`type باید یکی از ${approval_status_1.APPROVAL_TYPES.join('، ')} باشد`);
        }
        return value;
    }
    static assertStatus(value) {
        const status = value ?? 'pending_approval';
        if (!approval_status_1.APPROVAL_STATUSES.includes(status)) {
            throw new common_1.BadRequestException(`status باید یکی از ${approval_status_1.APPROVAL_STATUSES.join('، ')} باشد`);
        }
        return status;
    }
    static toItem(type, row) {
        return {
            id: row.id,
            type,
            status: row.status,
            name: row.name ?? null,
            tenantId: row.tenant_id ?? null,
            rejectionReason: row.rejection_reason,
            approvedAt: row.approved_at,
            approvedBy: row.approved_by,
            createdAt: row.created_at,
            pendingChanges: row.pending_changes ?? null,
        };
    }
    async list(user, query) {
        this.requireAdmin(user);
        const status = ApprovalsService_1.assertStatus(query.status);
        const types = query.type
            ? [ApprovalsService_1.assertType(query.type)]
            : [...approval_status_1.APPROVAL_TYPES];
        const rows = [];
        for (const type of types) {
            for (const row of await this.readQueue(type, status)) {
                rows.push(ApprovalsService_1.toItem(type, row));
            }
        }
        return { data: rows, total: rows.length };
    }
    async findOne(user, type, id) {
        this.requireAdmin(user);
        const target = ApprovalsService_1.assertType(type);
        const rows = await this.readOne(target, id);
        const row = rows[0];
        if (!row)
            throw new common_1.NotFoundException('درخواست یافت نشد');
        return ApprovalsService_1.toItem(target, row);
    }
    async approve(user, type, id) {
        this.requireAdmin(user);
        const target = ApprovalsService_1.assertType(type);
        if (target === 'service_line') {
            const applied = await this.dataSource.query(`SELECT admin_apply_service_line_approval($1::uuid, 'approved', $2::uuid) AS applied`, [id, user.userId]);
            if (!applied[0]?.applied)
                throw new common_1.NotFoundException('درخواست یافت نشد');
        }
        else if (target === 'tenant') {
            await this.dataSource.query(`UPDATE tenants t
            SET name = COALESCE(t.pending_changes ->> 'name', t.name),
                address = COALESCE(t.pending_changes ->> 'address', t.address),
                phone = COALESCE(t.pending_changes ->> 'phone', t.phone),
                cover_image_url = COALESCE(t.pending_changes ->> 'coverImage', t.cover_image_url),
                working_hours = COALESCE(t.pending_changes -> 'workingHours', t.working_hours),
                status = 'approved',
                rejection_reason = NULL,
                pending_changes = NULL,
                approved_at = NOW(),
                approved_by = $2
          WHERE t.id = $1`, [id, user.userId]);
        }
        else {
            await this.dataSource.query(`UPDATE specialists
            SET status = 'approved',
                rejection_reason = NULL,
                approved_at = NOW(),
                approved_by = $2
          WHERE id = $1`, [id, user.userId]);
        }
        return this.findOne(user, target, id);
    }
    async reject(user, type, id, reason) {
        this.requireAdmin(user);
        const target = ApprovalsService_1.assertType(type);
        if (target === 'service_line') {
            const applied = await this.dataSource.query(`SELECT admin_apply_service_line_approval($1::uuid, 'rejected', NULL, $2::text) AS applied`, [id, reason]);
            if (!applied[0]?.applied)
                throw new common_1.NotFoundException('درخواست یافت نشد');
        }
        else if (target === 'tenant') {
            await this.dataSource.query(`UPDATE tenants
            SET status = 'rejected',
                rejection_reason = $2,
                pending_changes = NULL
          WHERE id = $1`, [id, reason]);
        }
        else {
            await this.dataSource.query(`UPDATE specialists
            SET status = 'rejected',
                rejection_reason = $2
          WHERE id = $1`, [id, reason]);
        }
        return this.findOne(user, target, id);
    }
    async readQueue(type, status) {
        if (type === 'service_line') {
            return this.dataSource.query(`SELECT * FROM admin_list_service_line_approvals($1::approval_status)`, [status]);
        }
        if (type === 'tenant') {
            return this.dataSource.query(`SELECT t.id,
                t.name,
                t.status,
                t.rejection_reason,
                t.approved_at,
                t.approved_by,
                t.pending_changes,
                t.created_at
           FROM tenants t
          WHERE t.status = $1::approval_status
          ORDER BY t.created_at ASC, t.id ASC`, [status]);
        }
        return this.dataSource.query(`SELECT s.id,
              s.tenant_id,
              s.status,
              s.rejection_reason,
              s.approved_at,
              s.approved_by,
              s.created_at
         FROM specialists s
        WHERE s.status = $1::approval_status
        ORDER BY s.created_at ASC, s.id ASC`, [status]);
    }
    async readOne(type, id) {
        if (type === 'service_line') {
            return this.dataSource.query(`SELECT * FROM admin_get_service_line_approval($1::uuid)`, [id]);
        }
        if (type === 'tenant') {
            return this.dataSource.query(`SELECT t.id,
                t.name,
                t.address,
                t.phone,
                t.cover_image_url,
                t.working_hours,
                t.status,
                t.rejection_reason,
                t.approved_at,
                t.approved_by,
                t.pending_changes,
                t.created_at
           FROM tenants t
          WHERE t.id = $1::uuid`, [id]);
        }
        return this.dataSource.query(`SELECT s.id,
              s.tenant_id,
              s.user_id,
              s.bio,
              s.status,
              s.rejection_reason,
              s.approved_at,
              s.approved_by,
              s.created_at
         FROM specialists s
        WHERE s.id = $1::uuid`, [id]);
    }
};
exports.ApprovalsService = ApprovalsService;
exports.ApprovalsService = ApprovalsService = ApprovalsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], ApprovalsService);
