import { requireSession } from "@/lib/server/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { InstructorsSection } from "@/components/settings/instructors-section";
import { PaymentSettingsForm } from "@/components/settings/payment-settings-form";
import { prisma } from "@/lib/prisma";
import { Building2, CreditCard, Plug, Users } from "lucide-react";

export default async function SettingsPage() {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your business profile, integrations, and payment defaults.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Building2 className="size-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="instructors" className="flex items-center gap-2">
            <Users className="size-4" />
            Instructors
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Plug className="size-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="size-4" />
            Payment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>
                Used on invoices, Stripe, and multi-tenant scaling.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BusinessProfileForm business={business} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instructors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Instructor Management</CardTitle>
              <CardDescription>
                Add instructors, set hourly rates (for payroll), and toggle active status. Only
                active instructors appear in the booking form.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InstructorsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect FareHarbor for booking sync. Enter credentials and click Connect.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>
                Default payment method for manual entries. Revenue tab can filter by provider.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentSettingsForm business={business} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
