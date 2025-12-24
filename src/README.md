# PayAid CRM Module

**Status:** ⏳ **IN PROGRESS**  
**Purpose:** CRM functionality including contacts, deals, products, orders, tasks, and more

This is the CRM module that will be extracted into a separate repository (`payaid-crm`) in Phase 2.

---

## 📁 **Structure**

```
crm-module/
├── app/
│   ├── api/
│   │   ├── contacts/          # Contact management
│   │   ├── deals/             # Deal management
│   │   ├── products/          # Product catalog
│   │   ├── orders/            # Order management
│   │   ├── tasks/             # Task management
│   │   ├── leads/             # Lead management
│   │   ├── marketing/         # Marketing campaigns
│   │   ├── email-templates/    # Email templates
│   │   ├── social-media/      # Social media management
│   │   ├── landing-pages/     # Landing pages
│   │   ├── checkout-pages/    # Checkout pages
│   │   ├── events/            # Event management
│   │   ├── logos/             # Logo generation
│   │   ├── websites/          # Website builder
│   │   ├── chat/              # Team chat
│   │   └── chatbots/          # Chatbots
│   └── dashboard/
│       ├── contacts/
│       ├── deals/
│       ├── products/
│       ├── orders/
│       └── tasks/
└── lib/
    └── crm/                    # CRM-specific utilities
```

---

## 🔧 **Setup**

This module uses shared packages from `packages/@payaid/*`.

**Note:** This is a template structure. In the actual Phase 2 implementation, this will be a separate Next.js repository.

---

## 📋 **Routes**

### **Contact Routes:**
- `GET /api/contacts` - List all contacts
- `POST /api/contacts` - Create a new contact
- `GET /api/contacts/[id]` - Get a contact
- `PATCH /api/contacts/[id]` - Update a contact
- `DELETE /api/contacts/[id]` - Delete a contact
- `POST /api/contacts/import` - Import contacts
- `POST /api/contacts/test` - Test contact endpoint

### **Deal Routes:**
- `GET /api/deals` - List all deals
- `POST /api/deals` - Create a new deal
- `GET /api/deals/[id]` - Get a deal
- `PATCH /api/deals/[id]` - Update a deal
- `DELETE /api/deals/[id]` - Delete a deal

### **Product Routes:**
- `GET /api/products` - List all products
- `POST /api/products` - Create a new product
- `GET /api/products/[id]` - Get a product
- `PATCH /api/products/[id]` - Update a product
- `DELETE /api/products/[id]` - Delete a product

### **Order Routes:**
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create a new order
- `GET /api/orders/[id]` - Get an order
- `PATCH /api/orders/[id]` - Update an order
- `DELETE /api/orders/[id]` - Delete an order

### **Task Routes:**
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/[id]` - Get a task
- `PATCH /api/tasks/[id]` - Update a task
- `DELETE /api/tasks/[id]` - Delete a task

### **Lead Routes:**
- `GET /api/leads` - List all leads
- `POST /api/leads` - Create a new lead
- `GET /api/leads/[id]` - Get a lead
- `PATCH /api/leads/[id]` - Update a lead
- `POST /api/leads/[id]/allocate` - Allocate lead to sales rep
- `POST /api/leads/[id]/enroll-sequence` - Enroll lead in sequence
- `POST /api/leads/import` - Import leads
- `GET /api/leads/score` - Get lead scores

### **Marketing Routes:**
- `GET /api/marketing/campaigns` - List campaigns
- `POST /api/marketing/campaigns` - Create campaign
- `GET /api/marketing/campaigns/[id]` - Get campaign
- `PATCH /api/marketing/campaigns/[id]` - Update campaign
- `GET /api/marketing/segments` - List segments
- `POST /api/marketing/segments` - Create segment
- `GET /api/marketing/analytics` - Get analytics

### **Other Routes:**
- `GET/POST /api/email-templates/*` - Email templates
- `GET/POST /api/social-media/*` - Social media
- `GET/POST /api/landing-pages/*` - Landing pages
- `GET/POST /api/checkout-pages/*` - Checkout pages
- `GET/POST /api/events/*` - Events
- `GET/POST /api/logos/*` - Logo generation
- `GET/POST /api/websites/*` - Websites
- `GET/POST /api/chat/*` - Team chat
- `GET/POST /api/chatbots/*` - Chatbots

---

## 🔐 **Module Access**

All routes require the `crm` module license. Routes use `requireModuleAccess(request, 'crm')` from `@payaid/auth`.

---

**Status:** ⏳ **IN PROGRESS**

