export function capture(this: void, plan: ZPRadarCapturePlan, index: number): string | undefined {
    const view = render.GetViewSetup(true), ortho = view.ortho;
    const extent = plan.Overview.Scale * plan.Overview.Size;
    if (!ortho || Math.abs(ortho.bottom - ortho.top - extent) > 1 ||
        Math.abs(view.angles.p - 90) > 0.1 || Math.abs(view.angles.y - 90) > 0.1 || Math.abs(view.angles.r) > 0.1) return;
    const origin = Vector(view.origin.x + (ortho.right - ortho.left - extent) / 2, view.origin.y, view.origin.z);
    // Confirm that native overview mode received our camera, rather than an addon override.
    if (Math.abs(origin.x - plan.Overview.X) > 1 || Math.abs(origin.y - plan.Overview.Y) > 1) return;
    const cut = index < 0 ? origin.z - 1 : plan.Cuts[index];
    if (cut === undefined || cut >= origin.z) return;
    const target = GetRenderTarget("ZPRadarOverviewCapture", 1024, 1024);
    render.PushRenderTarget(target);
    try {
        render.Clear(22, 25, 29, 255, true, true);
        const oldClip = render.EnableClipping(true);
        try {
            render.PushCustomClipPlane(Vector(0, 0, -1), -cut);
            try {
                render.RenderView({ origin, angles: view.angles, x: 0, y: 0, w: 1024, h: 1024,
                    ortho: { left: 0, right: extent, top: -extent, bottom: 0 },
                    // Near clipping also cuts world brushes when custom clip planes are reset by a material pass.
                    znear: Math.max(1, origin.z - cut), zfar: origin.z - Math.min(...plan.Heights) + 256,
                    drawhud: false, drawviewmodel: false, drawviewer: false });
            } finally { render.PopCustomClipPlane(); }
        } finally { render.EnableClipping(oldClip); }
        return render.Capture({ format: "png", x: 0, y: 0, w: 1024, h: 1024, alpha: false });
    } finally { render.PopRenderTarget(); }
}
