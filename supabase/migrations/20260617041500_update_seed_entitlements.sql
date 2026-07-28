DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- We set one entitlement as false to demonstrate the "Contratar" UI in the dashboard
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'agencia-lit' LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    UPDATE public.entitlements
    SET ag1_assessor = true, ag2_copiloto = false, ag3_ativador = true
    WHERE tenant_id = v_tenant_id;
  END IF;
END $$;
