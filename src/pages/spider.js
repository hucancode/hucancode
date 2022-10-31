import React from "react";
import SpiderScene from "scenes/spider";
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { MdPlusOne } from "react-icons/md";
import Navbar from "components/navigation-bar";
import FootNote from "components/foot-note";

function Container(props) {
    return <div className="page-container">
        {props.children}
    </div>
}

function ProjectCard(props) {
    return <div className="challenge-card">
        {props.children}
    </div>
}

function ProjectMedia(props) {
    return <div className="media-3d w-full flex flex-col items-center">
        {props.children}
    </div>
}
function ActionButton(props) {
	return <button className="rounded-md bg-sky-300 dark:bg-gray-600 flex gap-2 items-center px-4 py-2 active:outline outline-2 outline-sky-700 cursor-pointer"
		onClick={props.onClick}>
			{props.children}
	</button>
}

export default function ProceduralSpider() {
    const { t } = useTranslation("challenge");
	const spider = React.useRef(null);
    return <Container>
        <Head>
            <title>{t("spider.title")}</title>
        </Head>
        <Navbar />
        <main>
            <ProjectCard>
                <ProjectMedia>
                    <SpiderScene  ref={spider} />
					<ActionButton onClick={() => spider.current.generateSpider()}>
						<MdPlusOne size="2.5em" />
						{t('spider.addMore')}
					</ActionButton>
                </ProjectMedia>
            </ProjectCard>
        </main>
        <FootNote />
    </Container>
}

export async function getStaticProps({ locale }) {
    return {
        props: {
            ...(await serverSideTranslations(locale, ['common', 'challenge'])),
            // Will be passed to the page component as props
        },
    };
}
