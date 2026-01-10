// Copyright (c) 2022 Panshak Solomon

import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import pdf from 'html-pdf'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import client from 'prom-client' // ✅ Prometheus client

import invoiceRoutes from './routes/invoices.js'
import clientRoutes from './routes/clients.js'
import userRoutes from './routes/userRoutes.js'
import profile from './routes/profile.js'

import pdfTemplate from './documents/index.js'
import emailTemplate from './documents/email.js'

// Load env variables FIRST
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Middleware
app.use(express.json({ limit: "30mb", extended: true }))
app.use(express.urlencoded({ limit: "30mb", extended: true }))
app.use(cors())

// Prometheus Metrics ✅
const collectDefaultMetrics = client.collectDefaultMetrics
collectDefaultMetrics() // Collect CPU, memory, and Node.js default metrics

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType)
    res.end(await client.register.metrics())
  } catch (err) {
    res.status(500).end(err)
  }
})

// Routes
app.use('/invoices', invoiceRoutes)
app.use('/clients', clientRoutes)
app.use('/users', userRoutes)     // ✅ signup lives here
app.use('/profiles', profile)

// Health check
app.get('/', (req, res) => {
  res.send('SERVER IS RUNNING')
})

// NODEMAILER TRANSPORT
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
})

// PDF options
const options = { format: 'A4' }

// SEND PDF VIA EMAIL
app.post('/send-pdf', (req, res) => {
  const { email, company } = req.body

  pdf.create(pdfTemplate(req.body), options).toFile('invoice.pdf', (err) => {
    if (err) return res.status(500).send(err)

    transporter.sendMail({
      from: `Accountill <hello@accountill.com>`,
      to: email,
      replyTo: company.email,
      subject: `Invoice from ${company.businessName || company.name}`,
      html: emailTemplate(req.body),
      attachments: [{
        filename: 'invoice.pdf',
        path: `${__dirname}/invoice.pdf`
      }]
    })

    res.send({ success: true })
  })
})

// CREATE PDF
app.post('/create-pdf', (req, res) => {
  pdf.create(pdfTemplate(req.body), {}).toFile('invoice.pdf', (err) => {
    if (err) return res.status(500).send(err)
    res.send({ success: true })
  })
})

// FETCH PDF
app.get('/fetch-pdf', (req, res) => {
  res.sendFile(`${__dirname}/invoice.pdf`)
})

// MongoDB + Server
const DB_URL = process.env.DB_URL
const PORT = process.env.PORT || 5000

mongoose.connect(DB_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  app.listen(PORT, () =>
    console.log(`Server running on port ${PORT}`)
  )
})
.catch(err => console.error(err))
