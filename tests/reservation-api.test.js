/**
 * Unit tests for Reservation API v2
 */

const request = require('supertest');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// Mock Supabase
jest.mock('@supabase/supabase-js');

describe('Reservation API v2', () => {
  let app;
  let supabaseMock;
  
  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Mock Supabase client
    supabaseMock = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis()
    };
    
    // Attach supabase to request
    app.use((req, res, next) => {
      req.supabase = supabaseMock;
      next();
    });
    
    // Mount API routes
    const reservationRouter = require('../api/reservations-v2');
    app.use('/api/v2', reservationRouter);
  });
  
  describe('POST /api/v2/reservations', () => {
    test('creates reservation with UTC normalization', async () => {
      // Mock successful insert
      supabaseMock.select.mockResolvedValue({
        data: [{
          id: 'test-id',
          slot_start_at_utc: '2025-09-04T12:30:00.000Z',
          slot_end_at_utc: '2025-09-04T13:00:00.000Z',
          user_name: 'テスト太郎',
          people: 2
        }],
        error: null
      });
      
      // Mock constraint check
      supabaseMock.gte.mockResolvedValue({
        data: [],
        error: null
      });
      
      const response = await request(app)
        .post('/api/v2/reservations')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          storeId: 'store1',
          startAt: '2025-09-04T21:30:00+09:00', // JST
          name: 'テスト太郎',
          phone: '090-1234-5678',
          people: 2
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.reservation).toMatchObject({
        id: 'booking-test-id',
        start: '2025-09-04T12:30:00.000Z', // UTC
        end: '2025-09-04T13:00:00.000Z',
        classNames: ['fc-booking']
      });
    });
    
    test('returns 409 for duplicate idempotency key', async () => {
      // Mock unique constraint violation
      supabaseMock.select.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "uniq_idem_key"'
        }
      });
      
      const response = await request(app)
        .post('/api/v2/reservations')
        .set('Idempotency-Key', 'duplicate-key')
        .send({
          storeId: 'store1',
          startAt: '2025-09-04T21:30:00+09:00',
          name: 'テスト',
          phone: '090-1111-1111',
          people: 1
        });
      
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('duplicate_request');
    });
    
    test('returns 409 for slot already taken', async () => {
      // Mock slot constraint violation
      supabaseMock.select.mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "uniq_reservation_slot"'
        }
      });
      
      const response = await request(app)
        .post('/api/v2/reservations')
        .send({
          storeId: 'store1',
          startAt: '2025-09-04T21:30:00+09:00',
          name: 'テスト',
          phone: '090-2222-2222',
          people: 1
        });
      
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('slot_taken');
    });
    
    test('floors time to 30-minute boundary', async () => {
      let capturedData;
      supabaseMock.insert.mockImplementation((data) => {
        capturedData = data[0];
        return supabaseMock;
      });
      
      supabaseMock.select.mockResolvedValue({
        data: [{
          id: 'test-id',
          slot_start_at_utc: '2025-09-04T12:30:00.000Z',
          slot_end_at_utc: '2025-09-04T13:00:00.000Z'
        }],
        error: null
      });
      
      await request(app)
        .post('/api/v2/reservations')
        .send({
          storeId: 'store1',
          startAt: '2025-09-04T21:45:30+09:00', // 21:45 should floor to 21:30
          name: 'テスト',
          phone: '090-3333-3333',
          people: 1
        });
      
      expect(capturedData.slot_start_at_utc).toBe('2025-09-04T12:30:00.000Z'); // 21:30 JST in UTC
    });
    
    test('checks capacity constraints', async () => {
      // Mock constraint exists
      supabaseMock.gte.mockResolvedValue({
        data: [{
          max_groups: 2,
          max_people: 10
        }],
        error: null
      });
      
      // Mock existing reservations at capacity
      supabaseMock.select
        .mockResolvedValueOnce({ count: 2, error: null }) // group count
        .mockResolvedValueOnce({ 
          data: [{ people: 5 }, { people: 4 }], 
          error: null 
        }); // people count
      
      const response = await request(app)
        .post('/api/v2/reservations')
        .send({
          storeId: 'store1',
          startAt: '2025-09-04T21:00:00+09:00',
          name: 'テスト',
          phone: '090-4444-4444',
          people: 2 // Would exceed 10 people limit
        });
      
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('capacity_exceeded');
    });
    
    test('validates required fields', async () => {
      const response = await request(app)
        .post('/api/v2/reservations')
        .send({
          storeId: 'store1'
          // Missing required fields
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('missing_fields');
    });
  });
  
  describe('GET /api/v2/reservations', () => {
    test('returns formatted calendar events', async () => {
      supabaseMock.order.mockResolvedValue({
        data: [
          {
            id: 'res-1',
            slot_start_at_utc: '2025-09-04T12:00:00.000Z',
            slot_end_at_utc: '2025-09-04T12:30:00.000Z',
            user_name: 'ユーザー1',
            people: 2,
            status: 'confirmed'
          }
        ],
        error: null
      });
      
      const response = await request(app)
        .get('/api/v2/reservations')
        .query({ storeId: 'store1' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reservations).toHaveLength(1);
      expect(response.body.reservations[0]).toMatchObject({
        id: 'booking-res-1',
        title: 'ユーザー1 (2名)',
        start: '2025-09-04T12:00:00.000Z',
        end: '2025-09-04T12:30:00.000Z',
        allDay: false,
        classNames: ['fc-booking']
      });
    });
  });
  
  describe('GET /api/v2/constraints', () => {
    test('returns formatted constraint events', async () => {
      supabaseMock.order.mockResolvedValue({
        data: [
          {
            id: 'const-1',
            start_time: '2025-09-04T12:00:00.000Z',
            end_time: '2025-09-04T13:00:00.000Z',
            max_groups: 2,
            max_people: 10
          }
        ],
        error: null
      });
      
      const response = await request(app)
        .get('/api/v2/constraints')
        .query({ storeId: 'store1' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.constraints).toHaveLength(1);
      expect(response.body.constraints[0]).toMatchObject({
        id: 'constraint-const-1',
        start: '2025-09-04T12:00:00.000Z',
        end: '2025-09-04T13:00:00.000Z',
        display: 'background',
        classNames: ['fc-constraint'],
        backgroundColor: '#ffcccc'
      });
    });
  });
});