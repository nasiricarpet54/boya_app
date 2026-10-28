const fs = require('fs');
let s = fs.readFileSync('E:/boya/boya/backend/src/modules/booking/booking.service.ts', 'utf8');

// Find the listForCustomer method and add listForSpecialist after it
const listForCustomerIdx = s.indexOf('listForCustomer(customerId: string)');
if (listForCustomerIdx >= 0) {
  // Find the end of this method
  const methodEnd = s.indexOf('  }', listForCustomerIdx);
  if (methodEnd >= 0) {
    // Insert the new method after listForCustomer
    const newMethod = `  /**\n   * List bookings for a specific specialist - only their own bookings.\n   * Filters by both customerId and specialist's tenant.\n   */\n  async listForSpecialist(specialistId: string): Promise<{ data: CustomerBookingItem[] }> {\n    const rows = await this.dataSource.query<CustomerBookingRow[]>(\n      `SELECT id, tenant_id, status, starts_at, ends_at, total_price,\n              salon_name, service_name, specialist_name, notes, created_at\n       FROM get_customer_bookings($1)\n       WHERE tenant_id = (SELECT tenant_id FROM specialists WHERE id = $2)\n       ORDER BY created_at DESC, id`,\n      [specialistId, specialistId],\n    );\n\n    return {\n      data: rows.map((row) => ({\n        id: row.id,\n        status: row.status,\n        startsAt: row.starts_at.toISOString(),\n        endsAt: row.ends_at.toISOString(),\n        totalPrice: Number(row.total_price),\n        salonName: row.salon_name,\n        serviceName: row.service_name,\n        specialistName: row.specialist_name,\n        notes: row.notes,\n        createdAt: row.created_at.toISOString(),\n        tenantId: row.tenant_id,\n      })),\n    };\n  }\n`;
    
    s = s.slice(0, methodEnd) + newMethod + s.slice(methodEnd);
    console.log('Added listForSpecialist method');
  }
} else {
  console.log('listForCustomer not found');
}

// Also add a method to find a booking by ID for the specialist
const findByIdIdx = s.indexOf('async findById(tenantId: string, id: string)');
if (findByIdIdx >= 0) {
  const methodEnd = s.indexOf('  }', findByIdIdx);
  if (methodEnd >= 0) {
    const newMethod = `  /**\n   * Find a booking by ID, scoped to a specialist's tenant.\n   */\n  async findBookingById(specialistId: string, id: string): Promise<Booking> {\n    const specialist = await this.dataSource.getRepository(Specialist).findOne({\n      where: { id: specialistId },\n    });\n    if (!specialist) throw new NotFoundException('Specialist not found');\n\n    const booking = await this.dataSource.getRepository(Booking).findOne({\n      where: { id, tenantId: specialist.tenantId },\n    });\n    if (!booking) throw new NotFoundException('Booking not found');\n    return booking;\n  }\n`;
    
    s = s.slice(0, methodEnd) + newMethod + s.slice(methodEnd);
    console.log('Added findBookingById method');
  }
}

// Write the modified service
fs.writeFileSync('E:/boya/boya/backend/src/modules/booking/booking.service.ts', s);
console.log('Service file updated, length:', s.length);