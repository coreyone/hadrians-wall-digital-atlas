<script lang="ts">
	import "../app.css";
	import WallcastPlayer from "$lib/components/wallcast/WallcastPlayer.svelte";
	import { wallcast } from "$lib/wallcast/store.svelte";

	let { children } = $props();

	$effect(() => {
		wallcast.init();
	});
</script>

{@render children()}

<WallcastPlayer />
