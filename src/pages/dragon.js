import React from "react";
import DragonScene from "scenes/dragon";
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { RiRefreshFill } from 'react-icons/ri';
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

export default function ProceduralDragon() {
    const { t } = useTranslation("challenge");
	const dragon = React.useRef(null);
    return <Container>
        <Head>
            <title>{t("dragon.title")}</title>
        </Head>
        <Navbar />
        <main>
            <ProjectCard>
                <ProjectMedia>
                    <DragonScene ref={dragon} />
					<ActionButton
						onClick={() => dragon.current.newFlyingPath()}>
						<RiRefreshFill size="2.5em" />
						{t('dragon.refresh')}
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
            ...(await serverSideTranslations(locale, ['common', 'challenge', 'dragon'])),
            // Will be passed to the page component as props
        },
    };
}
