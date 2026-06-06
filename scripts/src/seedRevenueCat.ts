import { getUncachableRevenueCatClient } from "./revenueCatClient.js";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Bible Wake";

const ANNUAL_IDENTIFIER = "bible_wake_annual";
const WEEKLY_IDENTIFIER = "bible_wake_weekly2";
const PLAY_STORE_ANNUAL_IDENTIFIER = "bible_wake_annual:annual";
const PLAY_STORE_WEEKLY_IDENTIFIER = "bible_wake_weekly2:weekly";

const ANNUAL_DISPLAY_NAME = "Annual Premium";
const WEEKLY_DISPLAY_NAME = "Weekly Premium 2";

const APP_STORE_APP_NAME = "Bible Wake iOS";
const APP_STORE_BUNDLE_ID = "com.tinochiwara.biblewake";
const PLAY_STORE_APP_NAME = "Bible Wake Android";
const PLAY_STORE_PACKAGE_NAME = "com.tinochiwara.biblewake";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } =
    await listProjects({ client, query: { limit: 20 } });

  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find(
    (p) => p.name === PROJECT_NAME,
  );

  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });

  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let testStoreApp: App | undefined = apps.items.find(
    (a) => a.type === "test_store",
  );
  let appStoreApp: App | undefined = apps.items.find(
    (a) => a.type === "app_store",
  );
  let playStoreApp: App | undefined = apps.items.find(
    (a) => a.type === "play_store",
  );

  if (!testStoreApp) {
    throw new Error("No test store app found");
  } else {
    console.log("Test Store app found:", testStoreApp.id);
  }

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } =
    await listProducts({
      client,
      path: { project_id: project.id },
      query: { limit: 100 },
    });

  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    storeIdentifier: string,
    displayName: string,
    duration: "P1Y" | "P1W",
    isTestStore: boolean,
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) =>
        p.store_identifier === storeIdentifier && p.app_id === targetApp.id,
    );
    if (existing) {
      console.log(`${label} product already exists:`, existing.id);
      return existing;
    }

    const body: CreateProductData["body"] = {
      store_identifier: storeIdentifier,
      app_id: targetApp.id,
      type: "subscription",
      display_name: displayName,
    };

    if (isTestStore) {
      body.subscription = { duration };
      body.title = displayName;
    }

    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product: ${JSON.stringify(error)}`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const testAnnual = await ensureProduct(
    testStoreApp,
    "Test Annual",
    ANNUAL_IDENTIFIER,
    ANNUAL_DISPLAY_NAME,
    "P1Y",
    true,
  );
  const testWeekly = await ensureProduct(
    testStoreApp,
    "Test Weekly",
    WEEKLY_IDENTIFIER,
    WEEKLY_DISPLAY_NAME,
    "P1W",
    true,
  );
  const iosAnnual = await ensureProduct(
    appStoreApp,
    "iOS Annual",
    ANNUAL_IDENTIFIER,
    ANNUAL_DISPLAY_NAME,
    "P1Y",
    false,
  );
  const iosWeekly = await ensureProduct(
    appStoreApp,
    "iOS Weekly",
    WEEKLY_IDENTIFIER,
    WEEKLY_DISPLAY_NAME,
    "P1W",
    false,
  );
  const androidAnnual = await ensureProduct(
    playStoreApp,
    "Android Annual",
    PLAY_STORE_ANNUAL_IDENTIFIER,
    ANNUAL_DISPLAY_NAME,
    "P1Y",
    false,
  );
  const androidWeekly = await ensureProduct(
    playStoreApp,
    "Android Weekly",
    PLAY_STORE_WEEKLY_IDENTIFIER,
    WEEKLY_DISPLAY_NAME,
    "P1W",
    false,
  );

  const addTestPrices = async (
    product: Product,
    label: string,
    prices: { amount_micros: number; currency: string }[],
  ) => {
    console.log(`Adding test store prices for ${label} product:`, product.id);
    const { data, error } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: product.id },
      body: { prices },
    });
    if (error) {
      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        (error as { type: string }).type === "resource_already_exists"
      ) {
        console.log(`Test store prices already exist for ${label}`);
      } else {
        throw new Error(`Failed to add test store prices for ${label}`);
      }
    } else {
      console.log(`Added test store prices for ${label}:`, JSON.stringify(data));
    }
  };

  await addTestPrices(testAnnual, "Annual", [
    { amount_micros: 39990000, currency: "USD" },
  ]);
  await addTestPrices(testWeekly, "Weekly", [
    { amount_micros: 6990000, currency: "USD" },
  ]);

  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } =
    await listEntitlements({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });

  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements.items?.find(
    (e) => e.lookup_key === ENTITLEMENT_IDENTIFIER,
  );

  if (existingEntitlement) {
    console.log("Entitlement already exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEntitlement, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: ENTITLEMENT_IDENTIFIER,
        display_name: ENTITLEMENT_DISPLAY_NAME,
      },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", newEntitlement.id);
    entitlement = newEntitlement;
  }

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: {
      product_ids: [
        testAnnual.id,
        testWeekly.id,
        iosAnnual.id,
        iosWeekly.id,
        androidAnnual.id,
        androidWeekly.id,
      ],
    },
  });

  if (attachEntErr) {
    if (
      attachEntErr &&
      typeof attachEntErr === "object" &&
      "type" in attachEntErr &&
      (attachEntErr as { type: string }).type === "unprocessable_entity_error"
    ) {
      console.log("Products already attached to entitlement (or some already were)");
    } else {
      throw new Error("Failed to attach products to entitlement");
    }
  } else {
    console.log("Attached all products to entitlement");
  }

  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } =
    await listOfferings({
      client,
      path: { project_id: project.id },
      query: { limit: 20 },
    });

  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find(
    (o) => o.lookup_key === OFFERING_IDENTIFIER,
  );

  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: {
        lookup_key: OFFERING_IDENTIFIER,
        display_name: OFFERING_DISPLAY_NAME,
      },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  const { data: existingPackages, error: listPackagesError } =
    await listPackages({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      query: { limit: 20 },
    });

  if (listPackagesError) throw new Error("Failed to list packages");

  const ensurePackage = async (
    lookupKey: string,
    displayName: string,
    products: Product[],
    storeProducts: Product[],
  ): Promise<Package> => {
    const existing = existingPackages.items?.find(
      (p) => p.lookup_key === lookupKey,
    );
    let pkg: Package;
    if (existing) {
      console.log(`Package ${lookupKey} already exists:`, existing.id);
      pkg = existing;
    } else {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering!.id },
        body: { lookup_key: lookupKey, display_name: displayName },
      });
      if (error) throw new Error(`Failed to create package ${lookupKey}`);
      console.log(`Created package ${lookupKey}:`, newPkg.id);
      pkg = newPkg;
    }

    const allProducts = [...products, ...storeProducts];
    const { error: attachErr } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: allProducts.map((p) => ({
          product_id: p.id,
          eligibility_criteria: "all",
        })),
      },
    });

    if (attachErr) {
      if (
        attachErr &&
        typeof attachErr === "object" &&
        "type" in attachErr &&
        (attachErr as { type: string }).type === "unprocessable_entity_error"
      ) {
        console.log(`Package ${lookupKey} products already attached (or conflict)`);
      } else {
        throw new Error(`Failed to attach products to package ${lookupKey}`);
      }
    } else {
      console.log(`Attached products to package ${lookupKey}`);
    }

    return pkg;
  };

  await ensurePackage(
    "$rc_annual",
    "Annual Subscription",
    [testAnnual],
    [iosAnnual, androidAnnual],
  );
  await ensurePackage(
    "$rc_weekly",
    "Weekly Subscription",
    [testWeekly],
    [iosWeekly, androidWeekly],
  );

  const { data: testStoreApiKeys, error: testStoreApiKeysError } =
    await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: testStoreApp.id },
    });
  if (testStoreApiKeysError)
    throw new Error("Failed to list public API keys for Test Store app");

  const { data: appStoreApiKeys, error: appStoreApiKeysError } =
    await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: appStoreApp.id },
    });
  if (appStoreApiKeysError)
    throw new Error("Failed to list public API keys for App Store app");

  const { data: playStoreApiKeys, error: playStoreApiKeysError } =
    await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: playStoreApp.id },
    });
  if (playStoreApiKeysError)
    throw new Error("Failed to list public API keys for Play Store app");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:", project.id);
  console.log("Test Store App ID:", testStoreApp.id);
  console.log("App Store App ID:", appStoreApp.id);
  console.log("Play Store App ID:", playStoreApp.id);
  console.log(
    "Public API Keys - Test Store:",
    testStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A",
  );
  console.log(
    "Public API Keys - App Store:",
    appStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A",
  );
  console.log(
    "Public API Keys - Play Store:",
    playStoreApiKeys?.items.map((item) => item.key).join(", ") ?? "N/A",
  );
  console.log("====================\n");
}

seedRevenueCat().catch(console.error);
