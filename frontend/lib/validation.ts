import { z } from "zod";

export const csvFileSchema = z
  .instanceof(File)
  .refine((file) => file.name.toLowerCase().endsWith(".csv"), "Choose a .csv file.")
  .refine((file) => file.size > 0, "The CSV file is empty.")
  .refine(
    (file) => file.size <= 1024 * 1024 * 1024,
    "The CSV file must be 1 GB or smaller.",
  );

export const conversionSchema = z.object({
  longitudeColumn: z.string().min(1, "Select a longitude column."),
  latitudeColumn: z.string().min(1, "Select a latitude column."),
  nameColumn: z.string().optional(),
  categoryColumn: z.string().optional(),
  outputFormat: z.enum(["kml", "gpkg"], {
    error: "Select an output format.",
  }),
});

export type ConversionFormValues = z.infer<typeof conversionSchema>;
