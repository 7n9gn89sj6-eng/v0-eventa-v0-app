<<<<<<< HEAD
const onSubmit = async (values: AddEventFormData) => {
  // Build a single address string the API can parse
  const addressBits = [
    values.address?.trim(),
    values.city?.trim(),
    values.postcode?.trim(),
    values.country?.trim(),
  ].filter(Boolean);
  const address = addressBits.join(", ");

  // API expects: title, description, start, end, timezone?, location?, organizer_name?, creatorEmail (required)
  const payload = {
    title: values.title,
    description: values.description || "",
    start: new Date(values.startAt),          // server uses z.coerce.date()
    end: values.endAt ? new Date(values.endAt) : undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: {
      name: undefined,                        // you can map a venue field here if you add one
      address: address || undefined,
=======
"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Loader2, CheckCircle2, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"

const API_URL = "/api/events/submit"

const addEventSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    humanCheck: z
      .string()
      .toLowerCase()
      .refine((val) => val === "communities", {
        message: "Please type the correct word from the challenge",
      }),
    title: z.string().min(5, "Event title must be at least 5 characters"),
    description: z.string().min(20, "Description must be at least 20 characters"),
    address: z.string().min(5, "Address is required"),
    postcode: z.string().optional(),
    city: z.string().min(2, "City is required"),
    country: z.string().min(2, "Country is required"),
    startAt: z.string().min(1, "Start date and time is required"),
    endAt: z.string().min(1, "End date and time is required"),
    imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    externalUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.endAt) > new Date(data.startAt)
      }
      return true
    },
    {
      message: "End must be after start.",
      path: ["endAt"],
>>>>>>> fix: export AddEventForm; correct wrapper import
    },
    organizer_name: values.name || undefined,
    organizer_contact: undefined,             // map a contact field if you add one
    creatorEmail: values.email,               // ⚠ required by the route
    imageUrl: values.imageUrl || "",
    externalUrl: values.externalUrl || "",
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Submit failed (${res.status})`);
    }

    const data = await res.json();
    // Optional: route to the edit/confirm page returned by the API
    // router.push(data.editUrl);  // you already import useRouter
    alert("Event created! Check your email for the edit link.");
  } catch (e:any) {
    console.error("Submit error:", e);
    alert(e.message || "Failed to submit event");
  }
};
