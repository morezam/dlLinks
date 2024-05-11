import express from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-extra';

const app = express();

app.get('/', async (req, res) => {
	const url = req.query.url;

	const host = new URL(url).host;

	try {
		const browser = await puppeteer.launch({
			args: chromium.args,
			defaultViewport: chromium.defaultViewport,
			executablePath: await chromium.executablePath(),
			headless: chromium.headless,
		});

		const page = await browser.newPage();

		await page.setRequestInterception(true);

		page.on('request', request => {
			if (request.resourceType() === 'image') {
				request.abort();
			} else if (request.resourceType() === 'stylesheet') {
				request.abort();
			} else if (request.resourceType() === 'font') {
				request.abort();
			} else {
				request.continue();
			}
		});

		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });

		let hel;
		if (host === 'digimoviez.com') {
			hel = await page.evaluate(() => {
				const itemDls = document.querySelectorAll('.itemdl.parent_item');

				return [...itemDls].map(item => {
					const sideLeft = item.querySelector('.side_left');
					const sideRight = item.querySelector('.side_right');

					const link = sideRight
						.querySelector('.btn_row_dl>a.btn_row.btn_dl')
						.getAttribute('href');

					const title = sideLeft
						.querySelector('.head_left_side')
						.querySelector('h3').innerText;

					const meta = [...sideLeft.querySelector('.meta').children].map(
						node => node.innerHTML
					);

					const desc = `${meta[0]} - size: ${meta[1]} - format: ${meta[2]}`;
					return { title, desc, link };
				});
			});
		} else if (host === 'zarfilm.com') {
			hel = await page.evaluate(() => {
				const items = document
					.querySelectorAll('.dllink_box')[0]
					.querySelector('.body_dllink_box').children;

				return [...items].map(item => {
					const rightSide = item.querySelector('.right_side');
					const leftSide = item.querySelector('.left_side');

					const link = rightSide.querySelector('a').getAttribute('href');

					const metaNode = leftSide.querySelector('.qualites_text_decode');

					const title = metaNode.querySelector('.quality_text').innerHTML;

					const details = metaNode.querySelector(
						'.bottom_meta_quality'
					).children;

					const descArr = [...details].map(detail => detail.outerText);

					const desc = `${descArr[0]} - ${descArr[1]} - ${descArr[2]}`;

					return { title, desc, link };
				});
			});
		} else if (host === 'mobomovies.online') {
			await page.waitForSelector('.tab-item');

			const tabItems = await page.$$('.tab-item');

			await tabItems[1].click();

			await page.waitForResponse(res =>
				res.url().includes('https://mobomovies.online/api/get-urls')
			);

			hel = await page.evaluate(() => {
				const items = document
					.querySelector('#dls')
					.querySelectorAll('.dropdown-menu');

				return [...items].map(item => {
					const title = item.querySelector('header').children[0].outerText;

					const headers = item.querySelectorAll('.links-sub-header');

					const qualities = [...headers].map(header => {
						const resDivs = header.children[0].children;
						let resolution = '';
						[...resDivs].forEach(div => {
							resolution += div.textContent.trim() + ' ';
						});

						console.log({ resolution });
						const content = header.nextSibling;
						const datas = content.querySelectorAll('.mdb.dl-btn');
						const episodes = [...datas].map(data => {
							const aNode = data.children[0];
							const text = aNode.outerText.replace('قسمت', '').trim();
							const link = aNode.getAttribute('href');
							return { text, link };
						});
						return { resolution, episodes };
					});

					return { title, qualities };
				});
			});
		}

		res.json(hel);

		await page.close();

		await browser.close();
	} catch (error) {
		throw new Error(error.message);
	}
});

app.listen(process.env.PORT, () => console.log('Server ready on port 3000.'));
