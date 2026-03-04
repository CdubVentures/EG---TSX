(function () {
	const trustooEnv = "api.trustoo.io";
	// 当前页面是否为感谢页
	if (Shopify.Checkout) {
		// 是否存在uv和已pv的产品
		const clientId = localStorage.getItem("trustoo_uv");
		const pvProId = sessionStorage.getItem("tt_pv_product_id");
		const checkoutToken = Shopify.Checkout.token;
		if (clientId !== "null" && pvProId !== "null") {
			let data = "";
			if (Shopify.checkout && Shopify.checkout.order_id) {
				data += `&order_id=${Shopify.checkout.order_id}`;
			}
			if (checkoutToken) {
				data += `&checkout_token=${checkoutToken}`;
			}
			// 判断购物车中有没有已pv的产品
			// if (Shopify.checkout.line_items.some(it => it.product_id == pvProId)) {
			// 符合条件，发送记录
			if (data) {
				fetch(
					location.origin +
						`/apps/trustoo-proxy/api/v1/reviews/collect?client_id=${clientId}&event_category=checkout${data}`
				);
				sessionStorage.removeItem("tt_pv_product_id");
			}

			// }
		}
		const order_id = (Shopify.checkout && Shopify.checkout.order_id) || 0;
		let settings = null,
			words = null;
		let wordsLoadedCallback = null;
		let isWordsLoaded = false;
		const shop_id =
			window.ShopifyAnalytics &&
			ShopifyAnalytics.lib &&
			ShopifyAnalytics.lib.config &&
			ShopifyAnalytics.lib.config.Trekkie.defaultAttributes.shopId;
		const shop = (window.Shopify && window.Shopify.shop) || "";
		const lang = (Shopify && Shopify.locale) || "en";
		const style = document.createElement("style");
		style.textContent = `
		.tt-referral-term:hover {text-decoration: underline;}
		@keyframes tt_show_window {0% {transform: scale(0.6);}100% {transform: scale(1);}
	`;
		document.head.appendChild(style);
		let url = `https://${trustooEnv}/api/v1/reviews/get_referral_setting?`;
		// let url =
		let getShareLinkUrl = `https://${trustooEnv}/api/v1/reviews/get_share_link?`;
		let getAutoReviewSettings = `https://${trustooEnv}/api/v1/reviews/get_auto_leave_review_setting?scene=thank_you&`;
		let flag = false;
		let shareLink = "";
		const params = { shop, shop_id, order_id, checkout_token: checkoutToken };
		const paramsStr = Object.keys(params)
			.reduce(
				(pre, it) => (params[it] ? `${pre}&${it}=${params[it]}` : pre),
				""
			)
			.slice(1);
		// if (shop_id) {
		// 	flag = true;
		// 	url += `shop_id=${shop_id}&`;
		// }
		// if (order_id) {
		// 	url += `&order_id=${order_id}`;
		// 	getShareLinkUrl += `&order_id=${order_id}`;
		// 	getAutoReviewSettings += `&order_id=${order_id}`;
		// }
		// if (shop) {
		// 	flag = true;
		// 	url += `shop=${shop}`;
		// }
		if (!paramsStr) {
			return;
		}
		url += paramsStr;
		getShareLinkUrl += paramsStr;
		getAutoReviewSettings += paramsStr;
		// const requests = [
		// 	fetch(url),
		// 	fetch(
		// 		`https://${trustooEnv}/api/v1/reviews/get_customer_self_define_lang?shop_id=${shop_id}&lang=${lang}`
		// 	),
		// ];
		fetch(url)
			.then(response => response.json())
			.then(async data => {
				let settingsData = data;

				if (settingsData.code !== 0) {
					throw { ...settingsData };
				}
				settings = settingsData.data;
				if (settings.is_active !== 1) {
					return;
				}
				isWordsLoaded = true;
				const wordsData = await fetch(
					`https://${trustooEnv}/api/v1/reviews/get_customer_self_define_lang?shop_id=${shop_id}&lang=${lang}`
				).then(response => response.json());
				console.log(wordsData);
				if (wordsData.code !== 0) {
					throw { ...wordsData };
				}
				const allWords = JSON.parse(wordsData.data.lang_json);
				if (wordsLoadedCallback) {
					wordsLoadedCallback(allWords.thankyou);
				}

				words = allWords.referral;
				words.discount = words.discount.replace(
					"{{friend_discount}}",
					settings.friend_discount_amount
				);
				words.reward = words.reward.replace(
					"{{advocate_reward}}",
					settings.advocate_reward
				);
				words.reward_desc = words.reward_desc
					.replace("{{friend_discount}}", settings.friend_discount_amount)
					.replace("{{advocate_reward}}", settings.advocate_reward);
				insertReferral();
			})
			.catch(error => {
				console.log("Request for Trustoo referral failed:", error);
			});

		function insertReferral(params) {
			const contentNode = document.querySelector(".content-box");
			contentNode.insertAdjacentHTML(
				"afterend",
				`<div style="margin-top:12px" id="tt-referral-wrapper">
				<div
				id="tt-referral-card"
				style="
					text-align: center;
					background: ${settings.card_bg_color};
					color: ${settings.card_text_color};
					border-radius: ${settings.card_border_radius + "px"} 
				"
			>
				<div
					style="padding: 20px 0 24px;background-image: linear-gradient(to right, white 75%, transparent 75%);background-position: bottom;background-repeat: repeat-x;background-size: 10px 2px;position: relative"
					"
				>
					<div style="line-height: 38px; font-size: 32px;font-weight:650">${
						words.discount
					}</div>
					<div style="line-height: 38px; font-size: 32px;font-weight:650">${
						words.reward
					}</div>
					<div
						style="position: absolute;width: 12px;height: 24px;background: #fff;bottom: -12px;left: 0;border-radius: 0 12px 12px 0
						"
					></div>
					<div
						style="
							position: absolute;
							width: 12px;
							height: 24px;
							background: #fff;
							bottom: -12px;
							right: 0;
							border-radius: 12px 0 0 12px;
						"
					></div>
				</div>
				<div style=" padding: 20px 0 30px ">
					<div style=" font-size: 16px;font-weight:650">${words.gift}</div>
					<div style=" max-width: 273px; margin: 12px auto 32px;font-size: 13px">
					${words.reward_desc}
					</div>
					<div style="position:relative">
					
					<button
					class="tt-referral-button"
					style="cursor:pointer;padding: 12px 15px;width: 77%;display: inline-block;font-weight:650;border: none;background: ${
						settings.button_bg_color
					};color: ${settings.button_text_color};border-radius: ${
					settings.button_border_radius + "px"
				}"
				>
				${words.code}
				</button>
					
					<div
					class="tt-referral-popup"
					style="display:none;justify-content: space-evenly;flex-wrap: wrap;width: 326px;max-width: calc(100vw - 30px);padding: 28px 0;border-radius:8px;position: absolute;top:-189px;left:50%;background:#fff;transform:translateX(-50%);border: 1px solid;
					"
				>
				<a target="_blank" href="https://facebook.com/sharer/sharer.php?u="><svg xmlns="http://www.w3.org/2000/svg"width="44"height="44"viewBox="0 0 44 44"fill="none"><g clip-path="url(#clip0_1989_35039)"><path d="M44 22C44 9.84984 34.1502 0 22 0C9.84984 0 0 9.84984 0 22C0 32.3171 7.10336 40.9746 16.6857 43.3523V28.7232H12.1493V22H16.6857V19.103C16.6857 11.6151 20.0746 8.1444 27.4261 8.1444C28.82 8.1444 31.225 8.41808 32.2089 8.69088V14.7849C31.6897 14.7303 30.7877 14.703 29.6674 14.703C26.0603 14.703 24.6664 16.0697 24.6664 19.6222V22H31.8525L30.6178 28.7232H24.6664V43.839C35.5599 42.5234 44 33.2482 44 22Z"fill="#0866FF"/></g><defs><clipPath id="clip0_1989_35039"><rect width="44"height="44"fill="white"/></clipPath></defs></svg></a>
				<a target="_blank" href="https://api.whatsapp.com/send?text="><svg xmlns="http://www.w3.org/2000/svg"width="44"height="44"viewBox="0 0 44 44"fill="none">
				<path d="M22 42.8108C34.1502 42.8108 44 33.2273 44 21.4054C44 9.58352 34.1502 0 22 0C9.84973 0 0 9.58352 0 21.4054C0 33.2273 9.84973 42.8108 22 42.8108Z"fill="#25D366"/><path fill-rule="evenodd"clip-rule="evenodd"d="M22.725 33.3144H22.7196C20.5301 33.3137 18.3789 32.7791 16.4681 31.7651L9.5332 33.5351L11.3891 26.9394C10.2443 25.0091 9.64191 22.8194 9.64289 20.5762C9.64576 13.5583 15.5143 7.84863 22.7249 7.84863C26.2245 7.8501 29.5091 9.17565 31.9789 11.5816C34.4488 13.9873 35.8082 17.1853 35.8068 20.5861C35.8039 27.6025 29.9377 33.3115 22.725 33.3144ZM16.7894 29.4608L17.1865 29.6901C18.8558 30.6541 20.7695 31.164 22.7206 31.1648H22.725C28.7179 31.1648 33.5956 26.4189 33.598 20.5854C33.5991 17.7586 32.4693 15.1007 30.4165 13.1009C28.3635 11.1013 25.6335 9.99946 22.7293 9.99847C16.7317 9.99847 11.854 14.7439 11.8516 20.5769C11.8508 22.5759 12.4256 24.5226 13.5141 26.207L13.7726 26.6073L12.6742 30.5112L16.7894 29.4608ZM28.8679 23.3266C29.0958 23.4338 29.2498 23.5062 29.3156 23.613C29.3972 23.7456 29.3972 24.3823 29.1251 25.1253C28.8525 25.8682 27.5467 26.5462 26.9186 26.6376C26.3555 26.7194 25.6428 26.7536 24.8599 26.5115C24.385 26.3649 23.7762 26.1693 22.9963 25.8415C19.932 24.5541 17.8612 21.6644 17.4697 21.1182C17.4423 21.08 17.4231 21.0533 17.4125 21.0393L17.4098 21.0359C17.2369 20.8113 16.0777 19.3066 16.0777 17.7493C16.0777 16.2844 16.8174 15.5165 17.1578 15.1631C17.1811 15.1388 17.2025 15.1166 17.2218 15.0961C17.5214 14.7778 17.8756 14.6981 18.0934 14.6981C18.3113 14.6981 18.5295 14.7001 18.7199 14.7094C18.7434 14.7106 18.7678 14.7104 18.7931 14.7102C18.9837 14.7092 19.2211 14.7079 19.4553 15.2554C19.5455 15.4661 19.6774 15.7784 19.8165 16.1079C20.0977 16.7741 20.4085 17.5103 20.4632 17.6169C20.5449 17.776 20.5993 17.9617 20.4904 18.174C20.474 18.2059 20.4589 18.236 20.4445 18.2646C20.3627 18.4272 20.3024 18.5468 20.1636 18.7045C20.109 18.7666 20.0525 18.8335 19.996 18.9004C19.8836 19.0337 19.7711 19.1668 19.6732 19.2617C19.5096 19.4204 19.3392 19.5923 19.5299 19.9108C19.7205 20.2292 20.3766 21.2706 21.3483 22.114C22.3929 23.0205 23.3008 23.4037 23.761 23.5979C23.8508 23.6358 23.9236 23.6665 23.9771 23.6925C24.3038 23.8518 24.4944 23.8251 24.6851 23.613C24.8758 23.4007 25.5023 22.6842 25.7201 22.3659C25.938 22.0477 26.156 22.1006 26.4556 22.2067C26.7553 22.313 28.3623 23.0823 28.6892 23.2415C28.753 23.2725 28.8127 23.3006 28.8679 23.3266Z"fill="#FDFDFD"/></svg></a>
				<a target="_blank" href="https://www.twitter.com/intent/tweet?text=&url="><svg xmlns="http://www.w3.org/2000/svg"width="44"height="44"viewBox="0 0 44 44"fill="none"><g clip-path="url(#clip0_1989_35044)"><mask id="mask0_1989_35044"style="mask-type: luminance"maskUnits="userSpaceOnUse"x="0"y="0"width="44"height="44"><path d="M0 0H44V44H0V0Z"fill="white"/></mask><g mask="url(#mask0_1989_35044)"><path d="M27.7194 31.9981H30.8991L16.2618 11.5132H13.082L27.7194 31.9981Z"fill="black"/><path fill-rule="evenodd"clip-rule="evenodd"d="M22 44C34.1499 44 44 34.1499 44 22C44 9.85013 34.1499 0 22 0C9.85013 0 0 9.85013 0 22C0 34.1499 9.85013 44 22 44ZM32.9692 9.988L24.2323 19.9247L33.7333 33.4547H26.7461L20.3471 24.3437L12.3376 33.4547H10.2667L19.4275 23.0355L10.2667 9.988H17.2539L23.3127 18.6164L30.8983 9.988H32.9692Z"fill="black"/></g></g><defs><clipPath id="clip0_1989_35044"><rect width="44"height="44"fill="white"/></clipPath></defs></svg></a>
					<div
						style="width: calc(100% - 48px);border: 1px solid #999;margin: 28px auto 0;padding: 5px 8px;display: flex;justify-content: space-between;align-items: center;border-radius: 4px;"
					>
			<div><svg xmlns="http://www.w3.org/2000/svg"width="15"height="15"viewBox="0 0 15 15"fill="none"><path d="M7.00033 4.84107C6.85675 4.95428 6.67655 5.01072 6.49404 4.99964C6.31154 4.98856 6.13949 4.91073 6.01066 4.78099C5.88184 4.65124 5.80524 4.47864 5.79546 4.29606C5.78568 4.11348 5.8434 3.93369 5.95762 3.79092L7.49933 2.23432C8.20167 1.55597 9.14235 1.18062 10.1188 1.18911C11.0952 1.19759 12.0292 1.58923 12.7196 2.27968C13.4101 2.97013 13.8017 3.90414 13.8102 4.88054C13.8187 5.85694 13.4433 6.79762 12.765 7.49996L11.1711 9.06401C11.1044 9.14197 11.0222 9.2053 10.9298 9.25C10.8374 9.29471 10.7368 9.31983 10.6342 9.32379C10.5316 9.32775 10.4293 9.31047 10.3338 9.27302C10.2382 9.23558 10.1514 9.17878 10.0788 9.1062C10.0062 9.03362 9.94941 8.94682 9.91197 8.85124C9.87452 8.75567 9.85724 8.65338 9.8612 8.55081C9.86516 8.44824 9.89028 8.34759 9.93499 8.25519C9.97969 8.16279 10.043 8.08063 10.121 8.01386L11.685 6.44981C12.0797 6.02625 12.2946 5.46603 12.2844 4.88718C12.2741 4.30833 12.0397 3.75604 11.6303 3.34666C11.2209 2.93729 10.6686 2.7028 10.0898 2.69258C9.51092 2.68237 8.9507 2.89724 8.52714 3.29191L7.00033 4.84107ZM8.02813 10.1365C8.09155 10.0507 8.17267 9.97953 8.26599 9.9278C8.35931 9.87608 8.46265 9.84501 8.56902 9.83669C8.67539 9.82838 8.78231 9.84301 8.88253 9.87961C8.98275 9.91621 9.07394 9.97392 9.14993 10.0488C9.22591 10.1237 9.28491 10.2141 9.32294 10.3138C9.36096 10.4135 9.37713 10.5202 9.37033 10.6266C9.36354 10.7331 9.33395 10.8369 9.28356 10.9309C9.23317 11.025 9.16317 11.1071 9.07828 11.1718L7.50678 12.7433C6.79913 13.3795 5.87474 13.7208 4.9234 13.6969C3.97206 13.673 3.06597 13.2858 2.39116 12.6148C1.71634 11.9438 1.32402 11.0399 1.29473 10.0887C1.26545 9.13751 1.60143 8.2112 2.23369 7.49996L3.80519 5.95825C3.86653 5.86924 3.94652 5.79465 4.03958 5.73966C4.13265 5.68467 4.23657 5.6506 4.34413 5.63982C4.45169 5.62903 4.56031 5.64179 4.66244 5.6772C4.76458 5.71261 4.85778 5.76984 4.93557 5.84489C5.01337 5.91995 5.07389 6.01104 5.11294 6.11184C5.15199 6.21263 5.16863 6.32073 5.16171 6.4286C5.15478 6.53648 5.12445 6.64156 5.07284 6.73653C5.02122 6.83151 4.94954 6.91411 4.86279 6.97861L3.28384 8.55011C2.88916 8.97367 2.6743 9.53388 2.68451 10.1127C2.69472 10.6916 2.92922 11.2439 3.33859 11.6532C3.74797 12.0626 4.30026 12.2971 4.87911 12.3073C5.45796 12.3175 6.01818 12.1027 6.44174 11.708L8.02813 10.1365ZM6.17361 9.89072C6.10685 9.96869 6.02468 10.032 5.93228 10.0767C5.83988 10.1214 5.73923 10.1465 5.63666 10.1505C5.53409 10.1545 5.43181 10.1372 5.33623 10.0997C5.24066 10.0623 5.15385 10.0055 5.08127 9.93291C5.00869 9.86033 4.95189 9.77353 4.91445 9.67795C4.877 9.58238 4.85972 9.48009 4.86368 9.37752C4.86765 9.27495 4.89277 9.17431 4.93747 9.08191C4.98218 8.9895 5.0455 8.90734 5.12346 8.84057L8.81016 5.15388C8.95264 5.03186 9.13591 4.96811 9.32335 4.97535C9.5108 4.98259 9.68861 5.06029 9.82125 5.19293C9.95389 5.32558 10.0316 5.50339 10.0388 5.69083C10.0461 5.87828 9.98232 6.06155 9.86031 6.20403L6.17361 9.89072Z"fill="#666666"/></svg>
				<span class="tt-referral-link" style="margin-left: 3px;color: #000;max-width:170px;overflow:hidden;display:inline-block;white-space: nowrap;text-overflow: ellipsis"></span></div>
						<div
						class="tt-referral-copy"
							style="color: #fff;font-size: 13px;padding: 8px;background-color: #000;border-radius: 4px;cursor:pointer" >${
								words.copy
							}</div>
					</div>
					<div
						style="width: 10px;height: 10px;position: absolute;bottom: -10px;left: 50%;transform: rotate(45deg) translateX(-50%);background-color: #fff;"
					></div>
				</div>
					</div>
			
				</div>
			</div>
			<div style="margin-top: 8px; text-align: center;font-size:13px;line-hight:17px">
			${settings.new_customers_only === 1 ? `<div>${words.newOnly}</div>` : ""}
			${
				settings.minimum_purchase_amount
					? `<div>${words.amount_tip.replace(
							"{{minimum_amount}}",
							settings.minimum_purchase_amount
					  )}</div>`
					: ""
			}
			</div>
			<div
			class="tt-referral-term"
				style="margin: 8px auto;color: #1773B0;font-size: 13px;text-align: center;cursor: pointer;width:fit-content;line-hight:16px"
			>
				Terms of Service
			</div>
			<div
			id="trustoo-mask"
			style="align-items: center;background-color: rgba(0, 0, 0, 0.6);display: none;height: 100vh;justify-content: center;left: 0;position: fixed;top: 0;width: 100vw;z-index: 11001;"
			>
			<div
			id="term-wrapper"
				style="background-color: #fff;width: 1015px;max-width: 100vw;max-height: 100vh;overflow: auto;border-radius:8px;animation: tt_show_window 0.15s linear;"
			>
				<div
					style="padding: 36px 0;width: 891px;max-width: calc(100vw - 30px);margin: 0 auto;display: flex;font-size: 24px;line-height: 29px;justify-content: space-between;"
				>
					<div>${settings.shop_name} Referral Program – Terms of Service</div>
					<svg class="tt-mask-closer"style="cursor:pointer"xmlns="http://www.w3.org/2000/svg"width="20"height="20"viewBox="0 0 20 20"fill="none"><path d="M17.1441 19.0574C17.6713 19.5847 18.5262 19.5847 19.0535 19.0574C19.5807 18.5301 19.5807 17.6753 19.0535 17.148L11.9073 10.0018L19.0535 2.85563C19.5807 2.32836 19.5807 1.4735 19.0535 0.946231C18.5262 0.418966 17.6714 0.418966 17.1441 0.946231L9.9979 8.09241L2.85172 0.94623C2.32445 0.418965 1.46959 0.418965 0.942324 0.94623C0.415059 1.47349 0.415059 2.32836 0.942324 2.85563L8.08851 10.0018L0.942325 17.148C0.41506 17.6753 0.41506 18.5301 0.942325 19.0574C1.46959 19.5847 2.32446 19.5847 2.85172 19.0574L9.9979 11.9112L17.1441 19.0574Z"fill="#4A4A4A"/></svg>
				</div>
				<hr style="background-color: #e7e7e7; height: 1px; border: none" />
				<div
					style="width: 891px;max-width: calc(100vw - 30px);margin: 27px auto 58px;
					"
				>
					<p style="font-size: 16px;font-weight:450">
						You may earn rewards by successfully referring customers to the
						store, by sharing your unique link.
					<br /><br />
						A successful referral must meet the following criteria: 1. An order
						made
					<br /><br />
						directly through your unique link. If your link was used by a
						referred customer who leaves the page and purchases later, this will
						disable the referral tracking.
					<br /><br />
						2. If a minimum purchase amount is specified, the order must meet
						the required purchase amount or higher.
					<br /><br />
						3. The order made by the referred customer was successfully
						fulfilled.
					<br /><br />
						It is prohibited to refer yourself, including using a different
						email address, and to distribute your referral link via commercial
						advertising or spam.
					<br /><br />
						Once a successful referral has been detected, an email containing
						information on how to claim your reward will be sent out to you. It
						may take up to a day after the referral purchase is fulfilled for
						the referral to be detected.
					<br /><br />
						Rewards are accumulated separately for each unique link. If you make
						more than one purchase at the store, each purchase will result in
						generating a different link.
						<br /><br />
						Any abuse of this offer may result in the rescission of your
						referral credit and the referred customer's promo code as well as
						both parties' inability to participate in this or future promotions.
						Referral credit cannot be applied to previous purchases, and is not
						redeemable for cash. This referral program is subject to
						modification or termination at any time without notice.

					</p>
				</div>
			</div>
			</div>
			</div>`
			);

			const card = document.getElementById("tt-referral-card");
			const wrapper = document.getElementById("tt-referral-wrapper");
			const btn = card.querySelector(".tt-referral-button");
			const popup = card.querySelector(".tt-referral-popup");
			const shareA = popup.querySelectorAll(".tt-referral-popup a");
			const term = wrapper.querySelector(".tt-referral-term");
			const mask = document.getElementById("trustoo-mask");
			const termWrapper = mask.querySelector("#term-wrapper");
			const close = mask.querySelector(".tt-mask-closer");
			const copyBtn = popup.querySelector(".tt-referral-copy");
			const link = popup.querySelector(".tt-referral-link");
			copyBtn.onclick = () => {
				var range = document.createRange(); //创建一个range
				window.getSelection().removeAllRanges();
				range.selectNode(link); // 选中需要复制的节点
				window.getSelection().addRange(range); // 执行选中元素
				var successful = document.execCommand("copy"); // 执行 copy 操作
				if (successful) {
					setToast(words.copied);
				}
				// 移除选中的元素
				window.getSelection().removeAllRanges();
			};

			window.addEventListener("click", e => {
				if (!popup.contains(e.target)) {
					popup.style.display = "none";
				}
			});
			btn.onclick = e => {
				e.stopPropagation();
				const isFlex = popup.style.display == "flex";
				popup.style.display = isFlex ? "none" : "flex";
				if (!shareLink) {
					fetch(getShareLinkUrl)
						.then(response => response.json())
						.then(data => {
							if (data.code !== 0) {
								throw data;
							}
							shareLink = data.data.share_link;
							link.textContent = shareLink;
							shareA.forEach(it => (it.href += shareLink));
						})
						.catch(err => console.log(err));
				}
			};
			term.onclick = e => {
				e.stopPropagation();
				mask.style.display = "flex";
				document.body.style.overflow = "hidden";
			};
			close.onclick = e => {
				e.stopPropagation();
				mask.style.display = "none";
				document.body.style.overflow = "auto";
			};
			mask.onclick = e => {
				if (!termWrapper.contains(e.target)) {
					mask.style.display = "none";
					document.body.style.overflow = "auto";
				}
			};
			function setToast(msg, top = "10%", left = "50%") {
				var node = document.createElement("div");
				node.style.cssText = `left:${left};top:${top};box-sizing: border-box;position: fixed;padding: 9px 16px;border-radius: 8px;color: #fff;font-size: 16px;line-height: 1.4;background-color: #151515;transition: all 0.1s;transform: translateX(-50%);text-align: center;z-index: 9999999999;`;
				node.className = "toast";
				node.innerHTML = msg;
				document.body.appendChild(node);
				setTimeout(() => {
					document.querySelector(".toast").remove();
				}, 2000);
			}
		}
		fetch(getAutoReviewSettings)
			.then(res => res.json())
			.then(res => {
				if (res.code !== 0) {
					throw { ...res };
				}
				const settings = res.data;
				if (settings.is_active !== 1) {
					return;
				}
				insertAutoReviews(settings);
				const mask = document.getElementById("tt-auto-mask");
				const wrapper = document.getElementById("tt-auto-reviews");
				const title = wrapper.querySelector("#tt-auto-title");
				const desc = wrapper.querySelector("#tt-auto-desc");
				const primary = wrapper.querySelector("#tt-auto-primary");
				const secondary = wrapper.querySelector("#tt-auto-secondary");
				wordsLoadedCallback = words => {
					console.log(words);
					title.textContent = words.title;
					desc.textContent = words.desc.replace(
						"{{Store Name}}",
						settings.shop_name
					);
					primary.textContent = words.agree;
					secondary.textContent = words.notAgree;
					mask.style.display = "flex";
				};
				if (isWordsLoaded) {
				} else {
					fetch(
						`https://${trustooEnv}/api/v1/reviews/get_customer_self_define_lang?shop_id=${shop_id}&lang=${lang}`
					)
						.then(response => response.json())
						.then(wordsData => {
							if (wordsData.code !== 0) {
								throw { ...wordsData };
							}
							words = JSON.parse(wordsData.data.lang_json);
							wordsLoadedCallback(words.thankyou);
						});
				}
			})
			.catch(err => console.log(err));

		function insertAutoReviews(settings) {
			const autoReviews = `<div
			id="tt-auto-mask"
			style="align-items: center;background-color: rgba(0,0,0,0.6);display: none;height: 100vh;justify-content: center;left: 0;position: fixed;top: 0;width: 100vw;z-index: 11001;"
			><div
			id="tt-auto-reviews"
			style="
				display: flex;
				gap: 16px;
				flex-direction: column;
				padding: 24px 32px;
				background-color: ${settings.bg_color};
				color: ${settings.text_color};
				width: 546px;
				max-width: calc(100vw - 30px);
				border-radius: 8px;
				box-sizing: border-box;
				animation: tt_show_window 0.15s linear;
			"
			>
			<div style="font-size: 20px;font-weight: 550;" id="tt-auto-title">About automatic positive reviews</div>
			<div style="font-size: 14px;font-weight: 450;" id="tt-auto-desc">
				By agreeing, you authorize Store Name to automatically submit positive
				reviews on your behalf if no reviews are made within a certain period
				after you place an order, and you can update these reviews at any time
			</div>
			<div
				style="
					display: flex;
					justify-content: end;
					gap: 16px;
					align-items: center;
					font-weight: 450;
				"
			>
				<div id="tt-auto-secondary" style="color: ${settings.secondary_text_color}; font-size: 14px;cursor:pointer;">I Do Not Agree</div>
				<div
					style="
						background: ${settings.primary_bg_color};
						color: #fff;
						padding: 8px 16px;
						font-size: 14px;
						font-weight: 500;
						border-radius: ${settings.btn_border_radius}px;
						cursor:pointer;
					"
					id="tt-auto-primary"
				>
					I Agree
				</div>
			</div>
			</div></div>`;
			document.body.insertAdjacentHTML("beforeend", autoReviews);
			const primary = document.getElementById("tt-auto-primary");
			const secondary = document.getElementById("tt-auto-secondary");
			primary.onclick = () => setAutoLeaveReview(true);
			secondary.onclick = () => setAutoLeaveReview(false);
		}
		function setAutoLeaveReview(val) {
			fetch(`https://${trustooEnv}/api/v1/reviews/set_auto_leave_review`, {
				method: "POST", // 使用POST方法
				headers: {
					"Content-Type": "application/json", // 设置内容类型为JSON
				},
				body: JSON.stringify({
					shop,
					order_id,
					is_agree: val ? 1 : 0,
					checkout_token: checkoutToken,
					scene: "thank_you",
				}), // 将对象转换为JSON字符串
			});
			document.getElementById("tt-auto-mask").remove();
		}
	}
})();
